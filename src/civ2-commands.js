const CIV1_RELEASE_PROJECT = 'Deployment/ci-v1';
const HUBOT_JENKINS_AUTH = process.env.HUBOT_JENKINS_AUTH,
  HUBOT_JENKINS_URL = process.env.HUBOT_JENKINS_URL;

exports.deployV1 = function(robot) {
  const jenkins = require('jenkins')({
    baseUrl: `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`,
    crumbIssuer: true,
    promisify: true
  });

  return jenkins.job.build(CIV1_RELEASE_PROJECT);
};
