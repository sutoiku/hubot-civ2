const chai = require('chai');
const nock = require('nock');
const { expect } = chai;

describe('civ2', function() {
  let civ2;

  it('Adds https protocol if missing', (done) => {
    process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
    process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tlda';
    civ2 = require('../src/lib/civ2-commands.js');
    createApiHandlers('https', '/job/Deployment/job/ci-v1/build');

    civ2
      .deployV1()
      .then((response) => {
        expect(response.body.toString()).to.equal('ok');
        done();
      })
      .catch(done);
  });

  it('keeps existing protocol if present', (done) => {
    process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
    process.env.HUBOT_JENKINS_URL = 'http://myjenkins.mydomain.tldx';
    civ2 = require('../src/lib/civ2-commands.js');
    createApiHandlers('http');
    nock(`http://${process.env.HUBOT_JENKINS_AUTH}@myjenkins.mydomain.tldx`)
      .post('/job/Deployment/job/ci-v1/build')
      .reply(200, 'ok');
    civ2
      .deployV1()
      .then((response) => {
        expect(response.body.toString()).to.equal('ok');
        done();
      })
      .catch(done);
  });

  describe('Task civ1', () => {
    it('calls the right Jenkins job', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Deployment/job/ci-v1/build');

      civ2
        .deployV1()
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });

    it('passes tag if present', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Deployment/job/ci-v1/buildWithParameters?tag=pouet');

      civ2
        .deployV1('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Task Docker', () => {
    it('calls the right Jenkins job', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/marcus-to-docker-cloud/build');

      civ2
        .deployDocker()
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });

    it('passes tag if present', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/marcus-to-docker-cloud/buildWithParameters?tag=pouet');

      civ2
        .deployDocker('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Task Kubernetes', () => {
    it('calls the right Jenkins job', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/marcus-to-kubernetes/build');

      civ2
        .deployK8s()
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });

    it('passes tag if present', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/marcus-to-kubernetes/buildWithParameters?tag=pouet');

      civ2
        .deployK8s('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Task release', () => {
    it('calls the right Jenkins job', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/global-release/build');

      civ2
        .release()
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
    it('passes tag if present', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Release/job/global-release/buildWithParameters?tag=pouet');

      civ2
        .release('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Task create instance cluster', () => {
    it('passes the right tag', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Chore/job/feature-clusters/job/create/buildWithParameters?FEATURE=pouet');

      civ2
        .createFeatureCluster('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Task destroy instance cluster', () => {
    it('passes the right tag', (done) => {
      process.env.HUBOT_JENKINS_AUTH = 'bla:toto';
      process.env.HUBOT_JENKINS_URL = 'myjenkins.mydomain.tld';
      civ2 = require('../src/lib/civ2-commands.js');
      createApiHandlers('https', '/job/Chore/job/feature-clusters/job/destroy/buildWithParameters?FEATURE=pouet');

      civ2
        .destroyFeatureCluster('pouet')
        .then((response) => {
          expect(response.body.toString()).to.equal('ok');
          done();
        })
        .catch(done);
    });
  });

  describe('Github operations', () => {
    let civ2;

    beforeEach(() => {
      civ2 = require('../src/lib/civ2-commands.js');
    });

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

function createApiHandlers(protocol, route) {
  const prefix = protocol === 'https' ? 'https://' : '';

  nock(`${prefix}${process.env.HUBOT_JENKINS_URL}`)
    .get('/crumbIssuer/api/json')
    .reply(200, {
      crumb: 'fb171d526b9cc9e25afe80b356e12cb7',
      crumbRequestField: '.crumb'
    });

  if (route) {
    const baseUrl = `${prefix}${process.env.HUBOT_JENKINS_AUTH}@${process.env.HUBOT_JENKINS_URL}`;
    nock(baseUrl)
      .post(route)
      .reply(200, 'ok');
  }
}
