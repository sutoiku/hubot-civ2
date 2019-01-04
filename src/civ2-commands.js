const rp = require("request-promise");
const ghApi = require("./github-api");

const CI_API_ROOT = process.env.CI_API_ROOT;
const token = process.env.CI_API_AUTH;
const headers = {
  Authorization: `Basic ${token}`
};

exports.deployV1 = function(tag) {
  return buildJob("Deployment/ci-v1", tag);
};

exports.deployDocker = function(tag) {
  return buildJob("Release/marcus-to-docker-cloud", tag);
};
exports.deployK8s = function(tag) {
  return buildJob("Release/marcus-to-kubernetes", tag);
};

exports.release = function(tag, UpdatePivotalAndGitHub) {
  const additionalParameters = UpdatePivotalAndGitHub
    ? {
        UpdatePivotalAndGitHub
      }
    : undefined;
  return buildJob("Release/global-release", tag, additionalParameters);
};

exports.updateBot = function() {
  return buildJob("Chore/hubot/stoic-hubot/master");
};

exports.archive = function(repo, branch) {
  const encodedBranch = encodeURIComponent(branch);
  const url = `${CI_API_ROOT}archive/${repo}/${encodedBranch}`;
  return rp(url, {
    headers
  });
};

exports.createFeatureCluster = FEATURE => {
  return buildJob("Chore/feature-clusters/create", undefined, {
    FEATURE
  });
};

exports.destroyFeatureCluster = FEATURE => {
  return buildJob("Chore/feature-clusters/destroy", undefined, {
    FEATURE
  });
};

exports.getBranchInformation = async function(branchName) {
  try {
    const status = await ghApi.getAllReposBranchInformation(branchName);
    const message = formatBranchInformation(branchName, status);
    console.log(message);
    return message;
  } catch (error) {
    console.error(error);
    return `Error: ${error.message}`;
  }
};

function buildJob(name, tag, additionalParameters) {
  const baseUrl = getBaseUrl();
  const jenkins = require("jenkins")({
    baseUrl,
    crumbIssuer: true,
    promisify: true
  });
  let options = name;
  if (tag !== undefined) {
    options = {
      name: name,
      parameters: {
        tag
      }
    };
  }
  if (additionalParameters !== undefined) {
    if (typeof options !== "object") {
      options = {
        name: options,
        parameters: {}
      };
    }
    Object.assign(options.parameters, additionalParameters);
  }
  return jenkins.job.build(options);
}

function getBaseUrl() {
  const HUBOT_JENKINS_AUTH = process.env.HUBOT_JENKINS_AUTH,
    HUBOT_JENKINS_URL = process.env.HUBOT_JENKINS_URL;

  return HUBOT_JENKINS_URL.includes("://")
    ? HUBOT_JENKINS_URL.replace("://", `://${HUBOT_JENKINS_AUTH}@`)
    : `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`;
}

// HELPERS
function formatBranchInformation(branchName, status) {
  let result = "";
  if (Object.keys(status).length === 0) {
    return "Branch was not found on the product repositories";
  }

  for (const [repo, data] of Object.entries(status)) {
    result += getRepoReport(repo, branchName, data);
  }

  return result;
}

function getRepoReport(repoName, branchName, data) {
  const prStatus = getPRStatus(data);
  const repoUrl = `https://github.com/sutoiku/${repoName}/tree/${branchName}`;
  const statusReport = getStatusReport(data);
  return `* <${repoUrl}|${repoName}> : ${prStatus} - ${statusReport}\n`;
}

function getStatusReport({ status }) {
  const statuses = keepLatestStatus(status);
  let okStatus = 0;
  for (const stat of Object.values(statuses)) {
    const { state } = stat;
    if (state === "success") {
      okStatus++;
    }
  }
  return `${okStatus}/${Object.keys(statuses).length} checks ok`;
}

function keepLatestStatus(statuses) {
  const result = {};
  for (const stat of statuses) {
    const { context, updated_at } = stat;
    if (
      !result[context] ||
      new Date(updated_at) < new Date(result[context].updated_at)
    ) {
      result[context] = stat;
    }
  }
  return result;
}

function getPRStatus({ pr }) {
  if (pr) {
    const { number, state, html_url } = pr;
    return `<${html_url}|PR #${number} (${state})>`;
  }
  return "no PR";
}
