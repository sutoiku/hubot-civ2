exports.deployV1 = function(tag) {
  return buildJob("Deployment/ci-v1", tag);
};

exports.deployDocker = function(tag) {
  return buildJob("Release/marcus-to-docker-cloud", tag);
};
exports.deployK8s = function(tag) {
  return buildJob("Release/marcus-to-kubernetes", tag);
};

function buildJob(name, tag) {
  const baseUrl = getBaseUrl();
  const jenkins = require("jenkins")({
    baseUrl,
    crumbIssuer: true,
    promisify: true
  });
  let options = name;
  if (tag !== undefined) {
    options = { name: name, parameters: { tag } };
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
