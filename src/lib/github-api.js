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
  'stoic-io'
];

const PivotalTracker = require('./pivotal-tracker');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG_NAME = 'sutoiku';

const GitHub = require('github-api');
const gh = new GitHub({
  token: GITHUB_TOKEN
});
const Octokit = require('@octokit/rest');
const octokit = Octokit({ auth: GITHUB_TOKEN, previews: ['shadow-cat'] });

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
  const assignees = user && [user.githubLogin];

  const created = {};
  for (const repoName of prsToCreate) {
    const prSpec = {
      owner: GITHUB_ORG_NAME,
      repo: repoName,
      title: branchName,
      head: branchName,
      base: 'master',
      body: prText.description,
      draft: true
    };

    if (prText.name) {
      prSpec.title = prText.name;
    }

    const { repo } = branchInformation[repoName];
    const newPr = await octokit.pulls.create(prSpec);
    created[repoName] = newPr.data;

    try {
      await octokit.issues.update({
        owner: GITHUB_ORG_NAME,
        repo: branchName,
        issue_numner: newPr.data.number,
        assignees
      });
    } catch (err) {
      console.error('Error while updating : ', err);
    }
  }
  return created;
}

async function getAllReposBranchInformation(branchName) {
  const allBranches = {};
  for (const repoName of REPOS) {
    const repo = gh.getRepo(GITHUB_ORG_NAME, repoName);
    const repoData = await repoHasBranch(repo, repoName, branchName);
    if (repoData === null) {
      continue;
    }
    allBranches[repoName] = Object.assign({ repo }, repoData);
  }
  return allBranches;
}

async function repoHasBranch(repo, repoName, branchName) {
  try {
    const { data: branch } = await repo.getBranch(branchName);
    const { data: status } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repoName, branchName);
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

async function getBranchPr(repoName, branchName) {
  const prs = await octokit.pulls.list({ owner: GITHUB_ORG_NAME, repo: repoName});
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
  const message = `This pull request has been created by ${displayName} via the bot.\n\n# REPOS\n${strRepos}`;

  if (!pivotalTracker) {
    const ptLink = getPTLink(branchName);
    const description = `${message}\n\n# PT\n${ptLink}\n\n`;
    return { description };
  }

  return getPrTextWithPivotal(branchName, message);
}

async function getPrTextWithPivotal(branchName, message) {
  const ptId = getPtIdFromBranchName(branchName);
  if (!ptId) {
    return { description: message };
  }

  const pt = await pivotalTracker.getStory(ptId);
  const ptLink = getPTLink(branchName);

  const description = `${message}\n\n# PT\n\n${ptLink}\n\n# Description\n\n${pt.description}`;
  return { description, name: pt.name };
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
