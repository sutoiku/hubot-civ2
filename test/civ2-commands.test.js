const chai = require('chai');
const nock = require('nock');
const {
  expect
} = chai;

describe('civ2', function() {


  describe('Task civ1', () => {
    let civ2;
    it('calls Jenkins', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/civ2-commands.js');
      nock(`https://${process.env.HUBOT_JENKINS_URL}`)
          .get('/crumbIssuer/api/json')
          .reply(200,{"crumb":"fb171d526b9cc9e25afe80b356e12cb7","crumbRequestField":".crumb"});

      nock(`https://${process.env.HUBOT_JENKINS_AUTH}@${process.env.HUBOT_JENKINS_URL}`)
        .post('/job/Deployment/job/test-job/build')
        .reply(200, 'ok');
       civ2.deployV1().then((response)=>{
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
    afterEach(()=>{nock.restore();})
  })
});
