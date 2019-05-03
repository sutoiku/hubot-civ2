'use strict';

const { expect } = require('chai');
const nock = require('nock');
const nockBack = require('nock').back;
nockBack.setMode('lockdown');

const PivotalTracker = require('../src/pivotal-tracker');
const testStories = {
  'filter-': [
    {
      id: 1,
      name: '1',
      url: 'http://url1',
      labels: [{ name: 'repo/repo1' }, { name: 'repo/repo2' }],
      current_state: 'started'
    },
    { id: 2, name: '2', url: 'http://url2', labels: [], current_state: 'finished' },
    {
      id: 3,
      name: '3',
      url: 'http://url3',
      labels: [{ name: 'repo/repo1' }, { name: 'blah' }],
      current_state: 'delivered'
    }
  ],
  'filter-current_state=finished': [{ id: 2, name: '2', labels: [], current_state: 'finished' }],
  onelabel: [{ id: 2, name: '2', labels: [{ id: 1, name: 'hello' }], current_state: 'finished' }]
};

describe('Pivotal', () => {
  describe('Tracker', () => {
    let pt;
    beforeEach(() => {
      nock('https://www.pivotaltracker.com', {
        reqheaders: {
          'X-TrackerToken': 'token'
        }
      })
        .get(/\/services\/v5\/projects\/(project)\/stories(.*)/)
        .reply(200, function(path) {
          const filter = path.split('?')[1];
          return testStories['filter-' + filter];
        });
    });
    afterEach(() => {
      nock.cleanAll();
    });

    describe('getStories', async () => {
      it('returns stories', async () => {
        pt = new PivotalTracker('token', 'project');
        const stories = await pt.getStories();
        expect(stories).to.deep.equal(testStories['filter-']);
      });
      it('passes filter in the querystring', async () => {
        pt = new PivotalTracker('token', 'project');
        const stories = await pt.getStories({ current_state: 'finished' });
        expect(stories).to.deep.equal(testStories['filter-current_state=finished']);
      });
    });
    describe('updateStory', () => {
      it('passes the specified update object', async () => {
        let _body;
        nock('https://www.pivotaltracker.com', {
          reqheaders: {
            'X-TrackerToken': 'token',
            'Content-Type': 'application/json'
          }
        })
          .put('/services/v5/projects/project/stories/2', function(body) {
            _body = body;
            return true;
          })
          .reply(200, {});
        pt = new PivotalTracker('token', 'project');
        await pt.updateStory(testStories['filter-current_state=finished'][0], { abc: 'def' });
        expect(_body).to.deep.equal({ abc: 'def' });
      });
    });
    describe('updateStories', () => {
      it('performs 1 call per story', async () => {
        let nbcalls = 0;
        nock('https://www.pivotaltracker.com', {
          reqheaders: {
            'X-TrackerToken': 'token'
          }
        })
          .put('/services/v5/projects/project/stories/1')
          .reply(200, () => {
            nbcalls++;
            return {};
          })
          .put('/services/v5/projects/project/stories/2')
          .reply(200, () => {
            nbcalls++;
            return {};
          })
          .put('/services/v5/projects/project/stories/3')
          .reply(200, () => {
            nbcalls++;
            return {};
          });

        pt = new PivotalTracker('token', 'project');
        await pt.updateStories(testStories['filter-'], { abc: 'def' });
        expect(nbcalls).to.equal(3);
      });
    });

    describe('addLabels', () => {
      it('concatenates existing and added labels', async () => {
        let _body;
        nock('https://www.pivotaltracker.com', {
          reqheaders: {
            'X-TrackerToken': 'token',
            'Content-Type': 'application/json'
          }
        })
          .put('/services/v5/projects/project/stories/2', function(body) {
            _body = body;
            return true;
          })
          .reply(200, {});
        pt = new PivotalTracker('token', 'project');
        await pt.addLabels(testStories.onelabel, ['new1', 'new2']);
        expect(_body).to.deep.equal({
          labels: [
            {
              id: 1,
              name: 'hello'
            },
            {
              name: 'new1'
            },
            {
              name: 'new2'
            }
          ]
        });
      });
    });
    describe('changelog', () => {
      let changelog;
      beforeEach(() => {
        const pt = new PivotalTracker('token', 'project');
        changelog = pt.changelog(testStories['filter-']);
      });
      it('generates text changelog for all repos', () => {
        expect(changelog.txt.all).to.equal(' - 1 (#1)\n - 2 (#2)\n - 3 (#3)');
      });
      it('generates md changelog for all repos', () => {
        expect(changelog.markdown.all).to.equal(
          ' * 1 ([#1](http://url1))\n * 2 ([#2](http://url2))\n * 3 ([#3](http://url3))'
        );
      });
      it('generates md changelog for each repo', () => {
        expect(changelog.markdown.repos.repo1).to.equal(' * 1 ([#1](http://url1))\n * 3 ([#3](http://url3))');
      });
      it('generates text changelog for each repo', () => {
        expect(changelog.txt.repos.repo1).to.equal(' - 1 (#1)\n - 3 (#3)');
      });
      it('places stories without "repo/xxx" label in "others"', () => {
        expect(changelog.markdown.repos.other).to.equal(' * 2 ([#2](http://url2))');
        expect(changelog.txt.repos.other).to.equal(' - 2 (#2)');
      });
      it('adds repo names on changelog when requested', () => {
        changelog = pt.changelog(testStories['filter-'], { withRepositories: true });

        expect(changelog.markdown.all).to.equal(
          ' * 1 ([#1](http://url1)) (repo1,repo2)\n * 2 ([#2](http://url2))\n * 3 ([#3](http://url3)) (repo1)'
        );
      });
    });
  });
});
