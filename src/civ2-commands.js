const debug = require("debug")("hubot:civ2:commands");
const rp = require("request-promise");
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

  const baseUrl = HUBOT_JENKINS_URL.includes("://")
    ? HUBOT_JENKINS_URL.replace("://", `://${HUBOT_JENKINS_AUTH}@`)
    : `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`;

  return baseUrl;
}
