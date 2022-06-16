const GitHub = require('github-api');
const { GITHUB_TOKEN } = process.env;
const gh = new GitHub({ token: GITHUB_TOKEN });
const { Octokit } = require('@octokit/rest');
const aws = require('./aws');
const { log } = require('./utils');

const REPOS = [
  'core.stoic',
  'fermat',
  'kyu',
  'praxis',
  'principia',
  'stoic-duckdb',
  'stoic-io',
  'team',
  'demos.stoic',
  'marcus',
  'particula',
  'lorem',
  'pictura',
  'grid',
  'librarium',
  'stoic-kubernetes',
  'Utilities.stoic',
  'Components.stoic',
  'Datatypes.stoic',
  'Transforms.stoic',
  'AWS.stoic',
  'Worker.stoic',
  'Playground.stoic',
  'Visuals.stoic',
  'Transformations.stoic',
  'Engine.stoic',
];
const GITHUB_ORG_NAME = 'sutoiku';
const REPOS_MARKER = '# REPOS';
const REPO_BRANCH_SEPARATOR = '__';

module.exports = {
  getIssueLinksFromBranchName,
  getAllReposBranchInformation,
  createMissingPrs,
  deleteBranch,
  listRepos,
  mergePRs,
  closePRs,
  updatePRsDescriptions,
  deleteBranches,
  announcePRs,
  getReposAndIssuesId,
  getPrTextWithGitHubIssue,
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
    title: (await getIssueTitle(branchName, octokit)) || branchName,
    head: branchName,
    base: await getTargetBranch(targetBase, repoName, octokit),
    body: prText.description,
  });

  try {
    const response = await octokit.pulls.create(prSpec);
    return Object.assign({ repo: { name: repoName } }, response ? response.data : {});
  } catch (err) {
    log(`Failed to create PR ${prSpec.title} on ${prSpec.repo}`, err);

    return { repo: { name: repoName }, error: err };
  }
}

async function getTargetBranch(targetBase, repoName, octokit) {
  if (targetBase !== 'master') {
    return targetBase;
  }

  const repo = await octokit.request(`GET /repos/${GITHUB_ORG_NAME}/${repoName}`);
  return repo.data?.default_branch || targetBase;
}

async function getIssueTitle(branchName, octokit) {
  const infos = getReposAndIssuesId(branchName);

  if (infos.length === 1) {
    const { repoName, issueNumber } = infos[0];
    const issue = await octokit.request(`GET /repos/${GITHUB_ORG_NAME}/${repoName}/issues/${issueNumber}`);
    return issue.data?.title;
  } else {
    return branchName;
  }
}

async function getAllReposBranchInformation(branchName, userName) {
  const reposList = listRepos();
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
  const prObject = { description: '# Issues\n', id: branchName, name: branchName };
  const infos = getReposAndIssuesId(branchName);

  if (infos.length === 0) {
    prObject.description += '\n Github issue not found';
    return prObject;
  }

  for (const { repoName, issueNumber } of infos) {
    prObject.description += `\n - ${getIssueLink(repoName, issueNumber)}`;
    prObject.id += `-${repoName}-${issueNumber}`;
  }

  return prObject;
}

function getReposAndIssuesId(branchName) {
  const regex = new RegExp(`${REPO_BRANCH_SEPARATOR}([A-z\\.-]*)\\-([0-9]+)`, 'igm');
  const matches = branchName.match(regex) || []; // In the form (__{repoName}-{issueNumber});

  const repoAndIssueNumberlist = [];
  for (const match of matches) {
    const [repoName, issueNumber] = match.split('-');
    repoAndIssueNumberlist.push({ repoName: repoName.replace(REPO_BRANCH_SEPARATOR, ''), issueNumber });
  }

  return repoAndIssueNumberlist;
}

function getIssueLink(repoName, issueNumber) {
  return `https://github.com/sutoiku/${repoName}/issues/${issueNumber}`;
}

function getIssueLinksFromBranchName(branchName) {
  const infos = getReposAndIssuesId(branchName);
  const links = [];
  for (const { repoName, issueNumber } of infos) {
    links.push(getIssueLink(repoName, issueNumber));
  }
  return links;
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

function listRepos() {
  return REPOS;
}
