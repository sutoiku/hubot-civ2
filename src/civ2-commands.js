
exports.deployV1 = function(tag) {
  const CIV1_RELEASE_PROJECT = 'Deployment/ci-v1';
  const HUBOT_JENKINS_AUTH = process.env.HUBOT_JENKINS_AUTH,
    HUBOT_JENKINS_URL = process.env.HUBOT_JENKINS_URL;

  const baseUrl=HUBOT_JENKINS_URL.includes('://')
    ? HUBOT_JENKINS_URL.replace('://', `://${HUBOT_JENKINS_AUTH}@`)
    : `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`;

  const jenkins = require('jenkins')({
    baseUrl,
    crumbIssuer: true,
    promisify: true
  });
  let options=CIV1_RELEASE_PROJECT;
  if(tag!==undefined){
    options={name:CIV1_RELEASE_PROJECT, parameters:{ tag }};
  }
  return jenkins.job.build(options);
};
