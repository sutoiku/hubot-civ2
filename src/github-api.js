const REPOS = [
  "ryu",
  "kyu",
  "particula",
  "praxis",
  "lorem",
  "fermat",
  "officer",
  "principia",
  "demos.stoic",
  "grid",
  "core.stoic",
  "marcus",
  "pictura"
];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GitHub = require("github-api");
const gh = new GitHub({
  token: GITHUB_TOKEN
});
const helpers = require('./helpers');

module.exports = {
  getAllReposBranchInformation,
  getPTLink,
  createMissingPrs
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

  const prText = getPrText(
    branchName,
    userName,
    Object.keys(branchInformation)
  );

  const user = helpers.getUserFromSlackLogin(userName);
  const assignees = user && [user.githubLogin];

  const created = {};
  for (const repoName of prsToCreate) {
    const prSpec = {
      title: branchName,
      head: branchName,
      base: "master",
      body: prText,
      assignees
    };

    const {
      repo
    } = branchInformation[repoName];
    created[repoName] = await repo.createPullRequest(prSpec);
  }
  return created;
}

async function getAllReposBranchInformation(branchName) {
  const allBranches = {};
  for (const repoName of REPOS) {
    const repo = gh.getRepo("sutoiku", repoName);
    const repoData = await repoHasBranch(repo, branchName);
    if (repoData !== null) {
      allBranches[repoName] = Object.assign({
        repo
      }, repoData);
    }
  }
  return allBranches;
}

async function repoHasBranch(repo, branchName) {
  try {
    const {
      data: branch
    } = await repo.getBranch(branchName);
    const {
      data: status
    } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repo, branchName);
    const reviews = await getReviews(repo, pr);

    return {
      branch,
      status,
      pr,
      reviews
    };
  } catch (error) {
    if (error.message.startsWith("404")) {
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

// HELPERS
function getPrText(branchName, userName, repos) {
  const ptLink = getPTLink(branchName) || "No PT";
  const strRepos = repos.map(it => "`" + it + "`").join(",");
  const user = helpers.getUserFromSlackLogin(userName);
  const displayName = user ? user.firstName : userName;
  return `This pull request has been created by ${displayName} via the bot.\n\n# PT\n${ptLink}\n\n# REPOS\n${strRepos}`;
}

function getPTLink(branchName) {
  const ptId = getPtIdFromBranchName(branchName);
  return !!ptId && `https://www.pivotaltracker.com/story/show/${ptId}`;
}

function getPtIdFromBranchName(branchName) {
  const match = branchName.match(/\d+$/);
  return match && match[0];
}

async function getReviews(repo, pr){
  if(!pr){return}
  return new  Promise(function(resolve, reject) {
    repo._request('GET', `/repos/${repo.__fullname}/pulls/${pr.number}/reviews`, null, (err, body)=>{
      resolve(body)
    });

  });
}
