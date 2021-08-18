const chai = require('chai');
const nock = require('nock');
const civ2 = require('../src/lib/civ2-commands.js');

const { expect } = chai;

describe('civ2', function() {
  it('Adds https protocol if missing', async () => {
    process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
    process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tlda';
    createApiHandlers('https', '/job/Deployment/job/ci-v1/build');

    const response = await civ2.deployV1();
    expect(response.body.toString()).to.equal('ok');
  });

  it('keeps existing protocol if present', async () => {
    process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
    process.env.HUBOT_JENKINS_URL = 'http://myjenkins.mydomain.tldx';

    createApiHandlers('http');
    nock(`http://${process.env.HUBOT_JENKINS_AUTH}@myjenkins.mydomain.tldx`)
      .post('/job/Deployment/job/ci-v1/build')
      .reply(200, 'ok');
    const response = await civ2.deployV1();
    expect(response.body.toString()).to.equal('ok');
  });

  describe('Task civ1', () => {
    it('calls the right Jenkins job', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Deployment/job/ci-v1/build');

      const response = await civ2.deployV1();
      expect(response.body.toString()).to.equal('ok');
    });

    it('passes tag if present', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Deployment/job/ci-v1/buildWithParameters', 'tag=pouet');

      const response = await civ2.deployV1('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Task Docker', () => {
    it('calls the right Jenkins job', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/marcus-to-docker-cloud/build');

      const response = await civ2.deployDocker();
      expect(response.body.toString()).to.equal('ok');
    });

    it('passes tag if present', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/marcus-to-docker-cloud/buildWithParameters', 'tag=pouet');

      const response = await civ2.deployDocker('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Task Kubernetes', () => {
    it('calls the right Jenkins job', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/marcus-to-kubernetes/build');

      const response = await civ2.deployK8s();
      expect(response.body.toString()).to.equal('ok');
    });

    it('passes tag if present', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/marcus-to-kubernetes/buildWithParameters', 'tag=pouet');

      const response = await civ2.deployK8s('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Task release', () => {
    it('calls the right Jenkins job', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/global-release/build');

      const response = await civ2.release();
      expect(response.body.toString()).to.equal('ok');
    });

    it('passes tag if present', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Release/job/global-release/buildWithParameters', 'tag=pouet');

      const response = await civ2.release('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Task create instance cluster', () => {
    it('passes the right tag', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Chore/job/feature-clusters/job/create/buildWithParameters', 'FEATURE=pouet');

      const response = await civ2.createFeatureCluster('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Task destroy instance cluster', () => {
    it('passes the right tag', async () => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      createApiHandlers('https', '/job/Chore/job/feature-clusters/job/destroy/buildWithParameters', 'FEATURE=pouet');
      const response = await civ2.destroyFeatureCluster('pouet');
      expect(response.body.toString()).to.equal('ok');
    });
  });

  describe('Github operations', () => {
    describe('deleteBranch', () => {
      it('should call github API', async () => {
        nock('https://api.github.com')
          .delete('/repos/sutoiku/pipoRepo/git/refs/heads/branchToDelete')
          .reply(204);

        await civ2.deleteBranch('pipoRepo', 'branchToDelete');
      });
    });
  });

  afterEach(() => {
    nock.cleanAll();
    delete process.env.HUBOT_JENKINS_AUTH;
    delete process.env.HUBOT_JENKINS_URL;
  });
});

function createApiHandlers(protocol, route, body) {
  const prefix = protocol === 'https' ? 'https://' : '';

  nock(`${prefix}${process.env.HUBOT_JENKINS_URL}`)
    .get('/crumbIssuer/api/json')
    .reply(200, {
      crumb: 'fb171d526b9cc9e25afe80b356e12cb7',
      crumbRequestField: '.crumb'
    });

  if (route) {
    nock(`${prefix}${process.env.HUBOT_JENKINS_AUTH}@${process.env.HUBOT_JENKINS_URL}`)
      .post(route, body)
      .reply(200, 'ok');
  }
}
