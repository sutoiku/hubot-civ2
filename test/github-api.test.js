const expect = require('chai').expect;
const ghApi = require('../src/lib/github-api');

describe('Github API helpers', () => {
  describe('getReposAndIssuesId', () => {
    const scenarios = [
      {
        input: 'bug/test__components.stoic-33',
        expectation: [{ repoName: 'components.stoic', issueNumber: '33' }],
      },
      {
        input: 'branch/test',
        expectation: [],
      },
      {
        input: 'branch/test__kyu',
        expectation: [],
      },
      {
        input: 'fix/my-branch__praxis-42__particula-12',
        expectation: [{ repoName: 'praxis', issueNumber: '42' }, { repoName: 'particula', issueNumber: '12' }],
      },
    ];

    for (const { input, expectation } of scenarios) {
      it(`returns the repo and the issue associated in the branch name for '${input}'`, () => {
        expect(ghApi.getReposAndIssuesId(input)).to.deep.equal(expectation);
      });
    }
  });

  describe('getPrTextWithGitHubIssue', () => {
    const scenarios = [
      {
        input: 'bug/test__components.stoic-33',
        expectation: {
          description: '# Github\n\n - https://github.com/sutoiku/components.stoic/issues/33',
          id: 'bug/test__components.stoic-33-components.stoic-33',
          name: 'bug/test__components.stoic-33',
        },
      },
      {
        input: 'branch/test',
        expectation: {
          description: '# Github\n\n Github issue not found',
          id: 'branch/test',
          name: 'branch/test',
        },
      },
      {
        input: 'branch/test__kyu',
        expectation: {
          description: '# Github\n\n Github issue not found',
          id: 'branch/test__kyu',
          name: 'branch/test__kyu',
        },
      },
      {
        input: 'fix/my-branch__praxis-42__particula-12',
        expectation: {
          description: '# Github\n\n - https://github.com/sutoiku/praxis/issues/42\n - https://github.com/sutoiku/particula/issues/12',
          id: 'fix/my-branch__praxis-42__particula-12-praxis-42-particula-12',
          name: 'fix/my-branch__praxis-42__particula-12',
        },
      },
    ];

    for (const { input, expectation } of scenarios) {
      it(`returns correct descriptions for '${input}'`, () => {
        expect(ghApi.getPrTextWithGitHubIssue(input)).to.deep.equal(expectation);
      });
    }
  });
});
