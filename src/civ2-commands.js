const CIV1_RELEASE_PROJECT = 'Deployment/ci-v1';
const HUBOT_JENKINS_AUTH = process.env.HUBOT_JENKINS_AUTH,
  HUBOT_JENKINS_URL = process.env.HUBOT_JENKINS_URL;

exports.deployV1 = function(tag) {
  const jenkins = require('jenkins')({
    baseUrl: `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`,
    crumbIssuer: true,
    promisify: true
  });
  let options=CIV1_RELEASE_PROJECT;
  if(tag!==undefined){
    options={name:CIV1_RELEASE_PROJECT, parameters:{ tag }};
  }
  return jenkins.job.build(options);
};
