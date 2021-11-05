const REPOS = [
  'ryu',
  'kyu',
  'particula',
  'praxis',
  'librarium',
  'lorem',
  'fermat',
  'officer',
  'principia',
  'demos.stoic',
  'grid',
  'core.stoic',
  'marcus',
  'pictura',
  'stoic-io',
  'stoic-io-arrow',
  'stoic-native-commons',
  'team',
  'stoic-kubernetes',
];

const Jira = require('./jira');
const GitHub = require('github-api');
const { GITHUB_TOKEN } = process.env;
const gh = new GitHub({ token: GITHUB_TOKEN });
const { Octokit } = require('@octokit/rest');
const aws = require('./aws');

const jira = Jira.initialize();
const GITHUB_ORG_NAME = 'sutoiku';
const REPOS_MARKER = '# REPOS';

const ONE_MINUTE = 60 * 1e3;

module.exports = {
  getJiraLink,
  getAllReposBranchInformation,
  createMissingPrs,
  deleteBranch,
  mergePRs,
  closePRs,
  updatePRsDescriptions,
  deleteBranches,
  announcePRs,
  commentPtReferences,
};

function findMissingPrs(branchInformation) {
  const prsToCreate = [];
  for (const [repoName, data] of Object.entries(branchInformation)) {
    if (!data.pr) {
      prsToCreate.push(repoName);
    }
  }
  return prsToCreate;
}

async function createMissingPrs(branchName, userName, targetBase = 'master', options = {}) {
  const octokit = await getOctokit(userName);

  const branchInformation = await getAllReposBranchInformation(branchName, userName);
  const prsToCreate = findMissingPrs(branchInformation);

  if (prsToCreate.length === 0) {
    return null;
  }

  const prText = await getPrText(branchName, userName, Object.keys(branchInformation));

  const createPrPromises = prsToCreate.map((repoName) =>
    createPr(repoName, branchName, targetBase, prText, octokit, options)
  );

  const responses = await Promise.all(createPrPromises);
  const created = {};
  for (const response of responses) {
    if (response.repo && response.repo.name) {
      created[response.repo.name] = response;
    } else {
      console.log('Unexpected response from createPr', response);
    }
  }

  // asynchronously update descriptions with links after creation
  updatePRsDescriptions(branchName, userName);

  return created;
}

async function mergePRs(branchName, userName) {
  const octokit = await getOctokit(userName);
  const repos = await getAllReposBranchInformation(branchName, userName);
  const merged = [];

  const mergePromises = Object.values(repos).map(({ repoName, pr }) => {
    if (!pr) {
      return null;
    }

    merged.push(repoName);
    return octokit.pulls.merge({
      owner: GITHUB_ORG_NAME,
      repo: repoName,
      pull_number: pr.number,
      merge_method: 'squash',
    });
  });

  await Promise.all(mergePromises);
  return merged;
}

async function closePRs(branchName, userName) {
  const octokit = await getOctokit(userName);
  const repos = await getAllReposBranchInformation(branchName, userName);
  const closed = [];

  for (const [repo, { pr }] of Object.entries(repos)) {
    if (!!pr) {
      await octokit.pulls.update({ owner: GITHUB_ORG_NAME, repo, pull_number: pr.number, state: 'closed' });
      closed.push(repo);
    }
  }

  return closed;
}

async function announcePRs(branchName, text) {
  const repos = await getAllReposBranchInformation(branchName);
  const octokit = await getOctokit();

  const announced = [];

  const announcePromises = Object.values(repos).map(({ pr, name }) => {
    if (!pr) {
      return null;
    }

    announced.push(name);
    const params = { owner: GITHUB_ORG_NAME, repo: name, pull_number: pr.number, body: text, event: 'COMMENT' };
    return octokit.pulls.createReview(params);
  });

  await Promise.all(announcePromises);
  return announced;
}

async function updatePRsDescriptions(branchName, userName) {
  const repos = await getAllReposBranchInformation(branchName);
  const linkDescription = generateLinkDescription(repos);
  const updated = replaceLinks(repos, linkDescription);
  const octokit = await getOctokit(userName);

  const updatePromises = Object.values(updated).map(({ repoName, pr }) =>
    octokit.pulls.update({ owner: GITHUB_ORG_NAME, repo: repoName, pull_number: pr.number, body: pr.body })
  );

  try {
    return await Promise.all(updatePromises);
  } catch (err) {
    console.error('Error while updating descriptions', err);
  }
}

async function createPr(repoName, branchName, targetBase, prText, octokit, options) {
  const prSpec = Object.assign(options, {
    owner: GITHUB_ORG_NAME,
    repo: repoName,
    title: branchName,
    head: branchName,
    base: targetBase,
    body: prText.description,
  });

  if (prText.name) {
    prSpec.title = prText.name;
  }
  try {
    const response = await octokit.pulls.create(prSpec);
    return Object.assign({ repo: { name: repoName } }, response ? response.data : {});
  } catch (err) {
    return { repo: { name: repoName }, error: err };
  }
}

async function getAllReposBranchInformation(branchName, userName) {
  const status = await Promise.all(
    REPOS.map(async (repoName) => {
      const repo = gh.getRepo(GITHUB_ORG_NAME, repoName);
      const repoData = await repoHasBranch(repo, repoName, branchName, userName);
      return Object.assign({ repo, repoName }, repoData);
    })
  );

  const allBranches = {};

  for (const repoData of status) {
    if (!!repoData.name) {
      allBranches[repoData.name] = repoData;
    }
  }

  return allBranches;
}

async function repoHasBranch(repo, repoName, branchName, userName) {
  try {
    const { data: branch } = await repo.getBranch(branchName);
    const { data: status } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repoName, branchName, userName);
    const reviews = await getReviews(repo, pr);

    return { branch, status, pr, name: repoName, reviews };
  } catch (error) {
    if (error.message.startsWith('404')) {
      return null;
    }
    throw error;
  }
}

async function getBranchPr(repoName, branchName, userName) {
  const octokit = await getOctokit(userName);
  const prs = await octokit.pulls.list({ owner: GITHUB_ORG_NAME, repo: repoName });
  for (const pr of prs.data) {
    if (pr.head.ref === branchName) {
      return pr;
    }
  }
  return null;
}

async function deleteBranch(repoName, branchName) {
  const repo = gh.getRepo(GITHUB_ORG_NAME, repoName);
  const pathname = `/repos/${repo.__fullname}/git/refs/heads/${branchName}`;
  return requestOnRepo(repo, 'DELETE', pathname);
}

async function deleteBranches(branchName, userName) {
  const deleted = [];
  const repos = await getAllReposBranchInformation(branchName, userName);
  for (const [repoName, repo] of Object.entries(repos)) {
    await deleteBranch(repo.name, branchName);
    deleted.push(repoName);
  }

  return deleted;
}

async function addCommentPrReview(repos, body) {
  const octokit = await getOctokit();
  const commentPromises = [];
  for (const [repoName, repo] of Object.entries(repos)) {
    commentPromises.push(
      octokit.pulls.createReview({
        owner: GITHUB_ORG_NAME,
        repo: repoName,
        pull_number: repo.pr.number,
        body,
        event: 'COMMENT',
      })
    );
  }

  return Promise.all(commentPromises);
}

async function commentPtReferences(branchName) {
  if (!jira) {
    return null;
  }

  const issueId = await jira.getIdFromBranchName(branchName);
  if (!issueId) {
    return null;
  }

  const issueReferences = await searchIssueInAllRepos(issueId);
  if (!issueReferences) {
    return null;
  }

  const message = formatJiraReferences(issueId, issueReferences);
  const repos = await getAllReposBranchInformation(branchName);
  // Let's add the comment in only 1 of the repos, no spam.
  const firstRepoName = Object.keys(repos)[0];
  return addCommentPrReview({ [firstRepoName]: repos[firstRepoName] }, message);
}

async function searchIssueInAllRepos(ptId, retryCount = 0) {
  try {
    return await doSearchIssueInAllRepos(ptId);
  } catch (err) {
    if (err.message.includes('API rate limit exceeded') && retryCount < 5) {
      await sleep(ONE_MINUTE);
      return searchIssueInAllRepos(ptId, retryCount + 1);
    }

    throw err;
  }
}

async function doSearchIssueInAllRepos(issueId) {
  const octokit = await getOctokit();
  const q = `${issueId}+org:${GITHUB_ORG_NAME}`;

  const { data } = await octokit.search.code({ q });
  if (!data || data.total_count === 0) {
    return null;
  }

  const resultsPerRepo = {};
  for (const item of data.items) {
    const repoName = item.repository.name;
    resultsPerRepo[repoName] = resultsPerRepo[repoName] || [];
    resultsPerRepo[repoName].push(item);
  }
  return resultsPerRepo;
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

async function getPrText(branchName, userName, repos) {
  const strRepos = repos.map((it) => '`' + it + '`').join(',');
  const key = userName ? await aws.getUserKey(userName, 'github') : null;
  const message = !!key ? '' : `This pull request has been created by ${userName} via the bot.`;

  const trackerDesc = jira && (await getPrTextWithJira(branchName));
  return trackerDesc || { description: `${message}\n\n# JIRA\nTODO\n\n${REPOS_MARKER}\n\n${strRepos}` };
}

async function getPrTextWithJira(branchName) {
  const issueId = await jira.getIdFromBranchName(branchName);

  if (!issueId) {
    return null;
  }

  try {
    const story = await jira.getStory(issueId);
    const jiraLink = await getJiraLink(branchName);
    const description = `# JIRA\n\n${jiraLink}\n\n# Description\n\n${story.description}`;
    return { description, name: story.name };
  } catch (err) {
    console.error(`Error fetching JIRA #${issueId}`, err);
    return null;
  }
}

async function getJiraLink(branchName, options) {
  if (!jira) {
    return '';
  }

  const issueId = await jira.getIdFromBranchName(branchName);
  if (!issueId) {
    return;
  }

  const link = jira.makeLink(issueId);
  return formatLink(`Jira #${issueId}`, link, options);
}

function formatLink(text, link, { markdown = false, slack = false } = {}) {
  if (markdown) {
    return `[${text}](${link})`;
  }

  if (slack) {
    return `<${link}|${text}>`;
  }

  return link;
}

async function getReviews(repo, pr) {
  if (!pr) {
    return;
  }

  return requestOnRepo(repo, 'GET', `/repos/${repo.__fullname}/pulls/${pr.number}/reviews`);
}

function requestOnRepo(repo, method, pathname) {
  return new Promise(function (resolve, reject) {
    repo._request(method, pathname, null, (err, body) => (err ? reject(err) : resolve(body)));
  });
}

async function getOctokit(userName) {
  const key = userName ? await aws.getUserKey(userName, 'github') : null;
  return new Octokit({ auth: key || GITHUB_TOKEN, previews: ['shadow-cat'] });
}

function generateLinkDescription(repos) {
  const linkDdesc = [];

  for (const [repoName, { pr }] of Object.entries(repos)) {
    if (!pr) {
      continue;
    }

    const jenkinsLink = `[![Build Status](https://ci-v2.stoic.com/buildStatus/icon?job=Modules%2F${repoName}%2FPR-${pr.number})](https://ci-v2.stoic.com/job/Modules/job/${repoName}/view/change-requests/job/PR-${pr.number}/)`;
    linkDdesc.push(` * ${jenkinsLink} [${repoName} PR #${pr.number}](${pr.html_url})`);
  }

  return linkDdesc.join('\n');
}

function replaceLinks(repos, links) {
  const replaced = {};
  for (const [repoName, repo] of Object.entries(repos)) {
    const replacedRepo = Object.assign({ name: repoName }, repo);
    if (!replacedRepo.pr) {
      continue;
    }

    const idx = replacedRepo.pr.body.indexOf(REPOS_MARKER);
    replacedRepo.pr.body =
      replacedRepo.pr.body.substr(0, idx === -1 ? replacedRepo.pr.body.length : idx) +
      '\n\n' +
      REPOS_MARKER +
      '\n\n' +
      links;
    replaced[repoName] = replacedRepo;
  }

  return replaced;
}

function formatJiraReferences(issueId, refs) {
  const mdLink = `[#${issueId}](${jira.makeLink(issueId)})`;
  const messageParts = [`Pardon the interruption, but there seems to be some TODOs attached to this issue ${mdLink}. `];
  for (const [repoName, refs] of Object.entries(refs)) {
    const refList = refs.map(formatRefForList).join('\n');
    messageParts.push(`In \`${repoName}\` (${refs.length}):\n\n${refList}`);
  }

  messageParts.push('Did you take care of it ?');

  return messageParts.join('\n\n');
}

function formatRefForList({ html_url, name }) {
  return ` * [${name}](${html_url})`;
}

async function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
