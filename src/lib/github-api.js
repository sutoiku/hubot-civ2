const REPOS = [
  'ryu',
  'kyu',
  'particula',
  'praxis',
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
  'janus'
];

const PivotalTracker = require('./pivotal-tracker');
const GitHub = require('github-api');
const { GITHUB_TOKEN } = process.env;
const gh = new GitHub({ token: GITHUB_TOKEN });
const Octokit = require('@octokit/rest');
const helpers = require('./helpers');
const aws = require('./aws');

const pivotalTracker = initializePivotalTracker();
const GITHUB_ORG_NAME = 'sutoiku';
const REPOS_MARKER = '# REPOS';

module.exports = {
  getAllReposBranchInformation,
  getPTLink,
  createMissingPrs,
  deleteBranch,
  mergePRs,
  closePRs,
  updatePRsDescriptions,
  deleteBranches
};

function findMissingPrs(branchInformation) {
  const prsToCreate = [];
  for (const [repoName, data] of Object.entries(branchInformation)) {
    const hasPr = !!data.pr;
    if (!hasPr) {
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

  const created = {};
  for (const repoName of prsToCreate) {
    const newPr = await createPr(repoName, branchName, targetBase, prText, octokit, options);
    created[repoName] = newPr;
  }

  // asynchronously update descriptions with links after creation
  updatePRsDescriptions(branchName, userName);

  return created;
}

async function mergePRs(branchName, userName) {
  const octokit = await getOctokit(userName);
  const repos = await getAllReposBranchInformation(branchName, userName);
  const merged = [];

  for (const [repo, { pr }] of Object.entries(repos)) {
    if (!!pr) {
      await octokit.pulls.merge({ owner: GITHUB_ORG_NAME, repo, pull_number: pr.number });
      merged.push(repo);
    }
  }

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

async function updatePRsDescriptions(branchName, userName) {
  const repos = await getAllReposBranchInformation(branchName);
  const linkDescription = generateLinkDescription(repos);
  const updated = replaceLinks(repos, linkDescription);
  const octokit = await getOctokit(userName);
  for (const [repo, { pr }] of Object.entries(updated)) {
    await octokit.pulls.update({ owner: GITHUB_ORG_NAME, repo, pull_number: pr.number, body: pr.body });
  }
}

async function createPr(repoName, branchName, targetBase, prText, octokit, options) {
  const prSpec = Object.assign(options, {
    owner: GITHUB_ORG_NAME,
    repo: repoName,
    title: branchName,
    head: branchName,
    base: targetBase,
    body: prText.description
  });

  if (prText.name) {
    prSpec.title = prText.name;
  }
  try {
    const { data } = await octokit.pulls.create(prSpec);
    return data;
  } catch (err) {
    return { error: err };
  }
}

async function getAllReposBranchInformation(branchName, userName) {
  const allBranches = {};
  for (const repoName of REPOS) {
    const repo = gh.getRepo(GITHUB_ORG_NAME, repoName);
    const repoData = await repoHasBranch(repo, repoName, branchName, userName);
    if (repoData === null) {
      continue;
    }
    allBranches[repoName] = Object.assign({ repo }, repoData);
  }
  return allBranches;
}

async function repoHasBranch(repo, repoName, branchName, userName) {
  try {
    const { data: branch } = await repo.getBranch(branchName);
    const { data: status } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repoName, branchName, userName);
    //const reviews = await getReviews(repo, pr);

    return { branch, status, pr /*, reviews*/ };
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
    await deleteBranch(repo, branchName);
    deleted.push(repoName);
  }

  return deleted;
}

// HELPERS
async function getPrText(branchName, userName, repos) {
  const strRepos = repos.map((it) => '`' + it + '`').join(',');
  const user = helpers.getUserFromSlackLogin(userName);
  const displayName = user ? user.firstName : userName;
  const message = `This pull request has been created by ${displayName} via the bot.`;

  if (!pivotalTracker) {
    const ptLink = getPTLink(branchName);
    const description = `${message}\n\n# PT\n${ptLink}\n\n${REPOS_MARKER}\n\n${strRepos}`;
    return { description };
  }

  return getPrTextWithPivotal(branchName, message, strRepos);
}

async function getPrTextWithPivotal(branchName, message, strRepos) {
  const ptId = getPtIdFromBranchName(branchName);
  if (!ptId) {
    return { description: message };
  }

  try {
    const pt = await pivotalTracker.getStory(ptId);
    const ptLink = getPTLink(branchName);

    const description = `${message}\n\n# PT\n\n${ptLink}\n\n# Description\n\n${
      pt.description
    }\n\n${REPOS_MARKER}\n\n${strRepos}`;
    return { description, name: pt.name };
  } catch (err) {
    console.error(`Error fetching PT #${ptId}: ${err.message}`);
    return { description: message };
  }
}

function getPTLink(branchName) {
  const ptId = getPtIdFromBranchName(branchName);
  return !!ptId && `https://www.pivotaltracker.com/story/show/${ptId}`;
}

function getPtIdFromBranchName(branchName) {
  const match = branchName.match(/\d+$/);
  return match && match[0];
}

async function getReviews(repo, pr) {
  if (!pr) {
    return;
  }

  return requestOnRepo(repo, 'GET', `/repos/${repo.__fullname}/pulls/${pr.number}/reviews`);
}

function requestOnRepo(repo, method, pathname) {
  return new Promise(function(resolve, reject) {
    repo._request(method, pathname, null, (err, body) => (err ? reject(err) : resolve(body)));
  });
}

function initializePivotalTracker() {
  const { PIVOTAL_TRACKER_TOKEN, PIVOTAL_TRACKER_PROJECT } = process.env;
  if (!PIVOTAL_TRACKER_PROJECT || !PIVOTAL_TRACKER_TOKEN) {
    return;
  }

  return new PivotalTracker(PIVOTAL_TRACKER_TOKEN, PIVOTAL_TRACKER_PROJECT);
}

async function getOctokit(userName) {
  const key = await aws.getUserKey(userName, 'github');
  return Octokit({ auth: key || GITHUB_TOKEN, previews: ['shadow-cat'] });
}

function generateLinkDescription(repos) {
  const linkDdesc = [];
  for (const [repoName, { pr }] of Object.entries(repos)) {
    const jenkinsLink = `[![Build Status](https://ci-v2.stoic.com/buildStatus/icon?job=Modules%2F${repoName}%2FPR-${
      pr.number
    })](https://ci-v2.stoic.com/job/Modules/job/${repoName}/view/change-requests/job/PR-${pr.number}/)`;
    linkDdesc.push(` * ${jenkinsLink} [${repoName} PR #${pr.number}](${pr.html_url})`);
  }

  return linkDdesc.join('\n');
}

function replaceLinks(repos, links) {
  const replaced = {};
  for (const [repoName, repo] of Object.entries(repos)) {
    const replacedRepo = Object.assign({}, repo);
    const idx = replacedRepo.pr.body.indexOf(REPOS_MARKER);
    replacedRepo.pr.body =
      replacedRepo.pr.body.substr(0, idx === -1 ? replacedRepo.pr.body.length : idx) + REPOS_MARKER + '\n\n' + links;
    replaced[repoName] = replacedRepo;
  }

  return replaced;
}
