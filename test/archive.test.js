const chai = require('chai');
const nock = require('nock');
const { expect } = chai;

describe('Archive', () => {
  let Archiver;
  beforeEach(() => {
    process.env.CI_API_ROOT = 'http://fakeapi/';
    Archiver = require('../src/civ2-commands');
  });
  it('should get the right repo and branch', (done) => {
    nock('http://fakeapi')
      .get('/archive/reponame/branchname')
      .reply(200, 'ok');

    Archiver.archive('reponame', 'branchname').then((body) => {
      expect(body).to.equal('ok');
      done();
    });
  });

  it('should encode branch name', (done) => {
    nock('http://fakeapi')
      .get('/archive/reponame/branch%20name')
      .reply(200, 'ok');

    Archiver.archive('reponame', 'branch name').then((body) => {
      expect(body).to.equal('ok');
      done();
    });
  });
});
