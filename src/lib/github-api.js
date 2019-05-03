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
  'pictura'
];

const PivotalTracker = require('./pivotal-tracker');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG_NAME = 'sutoiku';

const GitHub = require('github-api');
const gh = new GitHub({
  token: GITHUB_TOKEN
});
const helpers = require('./helpers');
const pivotalTracker = initializePivotalTracker();

module.exports = {
  getAllReposBranchInformation,
  getPTLink,
  createMissingPrs,
  deleteBranch
};

async function mergePrs(branchName) {
  const branchInformation = await getAllReposBranchInformation(branchName);
  //check if possible

  //merge
}

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

async function createMissingPrs(branchName, userName) {
  const branchInformation = await getAllReposBranchInformation(branchName);
  const prsToCreate = findMissingPrs(branchInformation);

  if (prsToCreate.length === 0) {
    return null;
  }

  const prText = await getPrText(branchName, userName, Object.keys(branchInformation));

  const user = helpers.getUserFromSlackLogin(userName);
  console.log('USER', userName, user);
  const assignees = user && [user.githubLogin];
  console.log('ASSIGNEES', assignees);

  const created = {};
  for (const repoName of prsToCreate) {
    const prSpec = {
      title: branchName,
      head: branchName,
      base: 'master',
      body: prText.description
    };

    if (prText.name) {
      prSpec.title = prText.name;
    }

    const { repo } = branchInformation[repoName];
    created[repoName] = await repo.createPullRequest(prSpec);

    //set assignee is done via issues API
    await repo.editIssue(created[repoName].number, { assignees });
  }
  return created;
}

async function getAllReposBranchInformation(branchName) {
  const allBranches = {};
  for (const repoName of REPOS) {
    const repo = gh.getRepo(GITHUB_ORG_NAME, repoName);
    const repoData = await repoHasBranch(repo, branchName);
    if (repoData === null) {
      continue;
    }
    allBranches[repoName] = Object.assign({ repo }, repoData);
  }
  return allBranches;
}

async function repoHasBranch(repo, branchName) {
  try {
    const { data: branch } = await repo.getBranch(branchName);
    const { data: status } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repo, branchName);
    const reviews = await getReviews(repo, pr);

    return {
      branch,
      status,
      pr,
      reviews
    };
  } catch (error) {
    if (error.message.startsWith('404')) {
      return null;
    }
    throw error;
  }
}

async function getBranchPr(repo, branchName) {
  const prs = await repo.listPullRequests();
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

// HELPERS
async function getPrText(branchName, userName, repos) {
  const strRepos = repos.map((it) => '`' + it + '`').join(',');
  const user = helpers.getUserFromSlackLogin(userName);
  const displayName = user ? user.firstName : userName;
  const description = `This pull request has been created by ${displayName} via the bot.\n\n# PT\n${ptLink}\n\n# REPOS\n${strRepos}`;

  if (!pivotalTracker) {
    return { description };
  }

  return getPrTextWithPivotal(branchName, message);
}

async function getPrTextWithPivotal(branchName, message) {
  const ptId = getPtIdFromBranchName(branchName);

  const pt = await pivotalTracker.getStory(ptId);

  const description = (message = `\n\n# Description\n${pt.description}`);
  return { description, name };
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
  if (!PIVOTAL_TRACKER_PROJECT || !PIVOTAL_TRACKER_PROJECT) {
    return;
  }

  return new PivotalTracker(PIVOTAL_TRACKER_TOKEN, PIVOTAL_TRACKER_PROJECT);
}