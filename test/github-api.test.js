const expect = require('chai').expect;
const ghApi = require('../src/lib/github-api');

describe('Github API helpers', () => {
  describe('getReposAndIssuesId', () => {
    const scenarios = [
      {
        input: 'bug/test!components.stoic-33',
        expectation: { repoName: 'components.stoic', issueNumber: '33' },
      },
      {
        input: 'branch/test',
        expectation: { repoName: undefined, issueNumber: undefined },
      },
      {
        input: 'branch/test!kyu',
        expectation: { repoName: undefined, issueNumber: undefined },
      },
      {
        input: 'fix/my-branch!praxis-42!particula-12',
        expectation: { repoName: 'praxis', issueNumber: '42' },
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
        input: 'bug/test!components.stoic-33',
        expectation: {
          description: '# Github\n\n - https://github.com/sutoiku/components.stoic/issues/33',
          id: 'bug/test!components.stoic-33-components.stoic-33',
          name: 'bug/test!components.stoic-33',
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
        input: 'branch/test!kyu',
        expectation: {
          description: '# Github\n\n Github issue not found',
          id: 'branch/test!kyu',
          name: 'branch/test!kyu',
        },
      },
      {
        input: 'fix/my-branch!praxis-42!particula-12',
        expectation: {
          description: '# Github\n\n - https://github.com/sutoiku/praxis/issues/42',
          id: 'fix/my-branch!praxis-42!particula-12-praxis-42',
          name: 'fix/my-branch!praxis-42!particula-12',
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
