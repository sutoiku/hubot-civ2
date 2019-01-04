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
const gh = new GitHub({ token: GITHUB_TOKEN });

module.exports = { getAllReposBranchInformation };

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

async function createMissingPrs(branchName) {
  const branchInformation = await getAllReposBranchInformation(branchName);
  const prsToCreate = findMissingPrs(branchInformation);

  if (prsToCreate.length === 0) {
    return null;
  }

  const prText = getPrText(branchName, Object.keys(branchInformation));
  const created = {};
  for (const repo of prsToCreate) {
    const prSpec = {
      title: branchName,
      head: branchName,
      base: "master",
      body: prText
    };

    /*created[repo] = await branchInformation[repo].repo.createPullRequest(
      prSpec
    );*/
  }
  return created;
}

async function getAllReposBranchInformation(branchName) {
  const allBranches = {};
  for (const repoName of REPOS) {
    const repo = gh.getRepo("sutoiku", repoName);
    const repoData = await repoHasBranch(repo, branchName);
    if (repoData !== null) {
      allBranches[repoName] = Object.assign({ repo }, repoData);
    }
  }
  return allBranches;
}

async function repoHasBranch(repo, branchName) {
  try {
    const { data: branch } = await repo.getBranch(branchName);
    const { data: status } = await repo.listStatuses(branchName);
    const pr = await getBranchPr(repo, branchName);
    return { branch, status, pr };
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
function getPrText(branchName, repos) {
  const ptId = getPtIdFromBranchName(branchName);
  const ptLink = ptId
    ? `https://www.pivotaltracker.com/story/show/${ptId}`
    : "Not found.";
  return `# PT\n${ptLink}\n\n# REPOS\n${repos.join(",")}`;
}

function getPtIdFromBranchName(branchName) {
  const match = branchName.match(/\d+$/);
  return match && match[0];
}