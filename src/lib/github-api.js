const Jira = require('./jira');
const GitHub = require('github-api');
const { GITHUB_TOKEN } = process.env;
const gh = new GitHub({ token: GITHUB_TOKEN });
const { Octokit } = require('@octokit/rest');
const aws = require('./aws');
const { log } = require('./utils');

const https = require('https');
const url = require('url');

const { REPOS_URL = 'https://public.stoic.com/internal/meta/repositories.json' } = process.env;

const jira = Jira.initialize();
const GITHUB_ORG_NAME = 'sutoiku';
const REPOS_MARKER = '# REPOS';
const REPO_BRANCH_SEPARATOR = '!';
const ONE_MINUTE = 60 * 1e3;

module.exports = {
  getIssueLinkFromBranchName,
  getAllReposBranchInformation,
  createMissingPrs,
  deleteBranch,
  listRepos,
  mergePRs,
  closePRs,
  updatePRsDescriptions,
  deleteBranches,
  announcePRs,
  commentPtReferences,
  getReposAndIssuesId,
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
  const branchInformation = await getAllReposBranchInformation(branchName, userName);
  const prsToCreate = findMissingPrs(branchInformation);

  if (prsToCreate.length === 0) {
    return null;
  }

  const prText = await getPrText(branchName, userName, Object.keys(branchInformation));

  const octokit = await getOctokit(userName);
  const created = {};

  for (const { repoName } of Object.values(branchInformation)) {
    // Content creation on GH should remain sequential
    // https://docs.github.com/en/rest/guides/best-practices-for-integrators#dealing-with-secondary-rate-limits
    const response = await createPr(repoName, branchName, targetBase, prText, octokit, options);
    if (response?.repo?.name) {
      created[response.repo.name] = response;
    } else {
      console.log('Unexpected response from createPr', response);
    }
  }

  await updatePRsDescriptions(branchName, userName);

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

  for (const { repoName, pr } of Object.values(updated)) {
    const response = await updateOnePrDescription(octokit, repoName, pr);
    if (response.error) {
      console.error(`Error occured while updating PRs on "${repoName}"= ${response.error}`);
    }
  }
}

async function updateOnePrDescription(octokit, repoName, pr) {
  try {
    return await octokit.pulls.update({
      owner: GITHUB_ORG_NAME,
      repo: repoName,
      pull_number: pr.number,
      body: pr.body,
    });
  } catch (error) {
    return { error };
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

  if (prSpec.id) {
    prSpec.title = `[${prSpec.id}] ${prSpec.title}`;
  }

  try {
    const response = await octokit.pulls.create(prSpec);
    return Object.assign({ repo: { name: repoName } }, response ? response.data : {});
  } catch (err) {
    log(`Failed to create PR ${prSpec.title} on ${prSpec.repo}`, err);

    return { repo: { name: repoName }, error: err };
  }
}

async function getAllReposBranchInformation(branchName, userName) {
  const reposList = await listRepos();
  const status = await Promise.all(
    reposList.map(async (repoName) => {
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

  const trackerDesc = await getPrTextWithGitHubIssue(branchName);
  return trackerDesc || { description: `${message}\n\n# GITHUB\nTODO\n\n${REPOS_MARKER}\n\n${strRepos}` };
}

function getPrTextWithGitHubIssue(branchName) {
  const { repoName, issueNumber } = getReposAndIssuesId(branchName);
  const description = `# Github\n\n - ${getIssueLink(repoName, issueNumber)}`;
  return { description, name: branchName, id: `${repoName}-${issueNumber}` };
}

function getReposAndIssuesId(branchName) {
  const regex = new RegExp(`${REPO_BRANCH_SEPARATOR}([\\w\\.-]*)\\-([0-9]+)`, 'i');
  const matches = regex.exec(branchName);
  return { repoName: matches[1], issueNumber: matches[2] };
}

function getIssueLink(repoName, issueNumber) {
  return `https://github.com/sutoiku/${repoName}/issues/${issueNumber}`;
}

function getIssueLinkFromBranchName(branchName) {
  const { repoName, issueNumber } = getReposAndIssuesId(branchName);
  return getIssueLink(repoName, issueNumber);
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

    const idx = replacedRepo.pr.body?.indexOf(REPOS_MARKER);
    if (idx) {
      replacedRepo.pr.body =
        replacedRepo.pr.body.substr(0, idx === -1 ? replacedRepo.pr.body.length : idx) +
        '\n\n' +
        REPOS_MARKER +
        '\n\n' +
        links;
      replaced[repoName] = replacedRepo;
    } else {
      replacedRepo.pr.body = REPOS_MARKER + '\n\n' + links;
    }
  }

  return replaced;
}

async function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function listRepos() {
  const parsedUrl = url.parse(REPOS_URL);
  const jsonFile = await request(parsedUrl);

  return Object.keys(jsonFile.repositories);
}

// -----------------------------------------------------------------------------
// HTTPS
// -----------------------------------------------------------------------------

async function request(params) {
  return new Promise((resolve, reject) => {
    https.request(params, (res) => parseHttpRes(res, resolve, reject)).end();
  });
}

function parseHttpRes(res, resolve, reject) {
  const chunks = [];
  res.on('error', reject);
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const res = JSON.parse(Buffer.concat(chunks).toString());
    return res && res.error ? reject(res.error) : resolve(res);
  });
}
