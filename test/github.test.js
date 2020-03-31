const expect = require('chai').expect;
const gh = require('../src/lib/github');
describe('github', () => {
  const payload = {
    id: 123,
    action: 'closed',
    pull_request: {
      head: {
        ref: 'toto',
        repo: { name: 'titi' }
      },
      base: {
        ref: 'master'
      },
      merged: true
    }
  };

  it('identifies pr closings', () => {
    const prmessage = gh.getPR(payload);
    expect(prmessage).to.deep.equal({
      id: 123,
      repo: 'titi',
      branch: 'toto',
      base: 'master',
      action: 'closed',
      merged: true
    });
  });
});
