const chai = require('chai');
const sinon = require('sinon');
const Robot = require('../src/civ2');
const civ2Commands = require('../src/lib/civ2-commands');
const { setVariables, resetVariables } = require('./utils');

chai.use(require('sinon-chai'));

const { expect } = chai;

describe('hubot integration', () => {
  describe('Regisrations', () => {
    let robot;

    beforeEach(function () {
      robot = {
        respond: sinon.spy(),
        hear: sinon.spy(),
        router: { post: sinon.spy(), get: sinon.spy() },
      };

      new Robot(robot);
    });

    it('should register 17 listeners', () => {
      expect(robot.hear).to.have.callCount(17);
    });

    it('should register 0 responder', () => {
      expect(robot.respond).to.have.callCount(0);
    });

    it('should register 3 POST webhooks, 1 GET', () => {
      expect(robot.router.post).to.have.callCount(3);
      expect(robot.router.get).to.have.callCount(1);
    });

    it('should register a civ1 listener', () => {
      expect(robot.hear.getCall(0).args[0].toString()).to.equal('/deploy to civ1 ?(S*)/');
    });

    it('should register a dockercloud listener', () => {
      expect(robot.hear.getCall(1).args[0].toString()).to.equal('/deploy to dockercloud ?(S*)/');
    });

    it('should register a kubernetes listener', () => {
      expect(robot.hear.getCall(2).args[0].toString()).to.equal('/deploy to kubernetes ?(S*)/');
    });

    it('should register a release listener', () => {
      expect(robot.hear.getCall(3).args[0].toString()).to.equal('/release stoic (\\S+)/i');
    });

    it('should register a rollback listener', () => {
      expect(robot.hear.getCall(4).args[0].toString()).to.equal('/rollback stoic (\\S*)/i');
    });

    it('should register a cluster creation listener', () => {
      expect(robot.hear.getCall(5).args[0].toString()).to.equal('/create feature instance (\\S*)/i');
    });

    it('should register a cluster destruction listener', () => {
      expect(robot.hear.getCall(6).args[0].toString()).to.equal('/destroy feature instance (\\S*)/i');
    });

    it('should register a branch status information command', () => {
      expect(robot.hear.getCall(7).args[0].toString()).to.equal(/branch status (\S*)/i.toString());
    });

    it('should register a GH token set command', () => {
      expect(robot.hear.getCall(8).args[0].toString()).to.equal(/my github token is (\S*)/i.toString());
    });

    it('should register a GH token check command', () => {
      expect(robot.hear.getCall(9).args[0].toString()).to.equal(/what is my github token\?/i.toString());
    });

    it('should register a PR creation command', () => {
      expect(robot.hear.getCall(10).args[0].toString()).to.equal(/create pull requests (\S*)( to (\S*))?/i.toString());
    });

    it('should register a PR merge command', () => {
      expect(robot.hear.getCall(11).args[0].toString()).to.equal(/merge pull requests (\S*)/i.toString());
    });

    it('should register a PR close command', () => {
      expect(robot.hear.getCall(12).args[0].toString()).to.equal(/close pull requests (\S*)/i.toString());
    });

    it('should register a branch deletion command', () => {
      expect(robot.hear.getCall(13).args[0].toString()).to.equal(/delete branch (\S*)/i.toString());
    });

    it('should register a link update command', () => {
      expect(robot.hear.getCall(14).args[0].toString()).to.equal(/update links (\S*)/i.toString());
    });

    it('should register a instance update command', () => {
      expect(robot.hear.getCall(15).args[0].toString()).to.equal(
        /update instance (\S*)( on (\S*) environment)?( to version (\S*))?/i.toString()
      );
    });

    it('should register a public release listener', () => {
      expect(robot.hear.getCall(16).args[0].toString()).to.equal('/publicly release (\\S*)/i');
    });
  });

  // -----------------------------------------------------------------------------
  // CHAT TRIGGERS
  // -----------------------------------------------------------------------------

  describe('Commands', () => {
    let civ2mock;
    let robot;

    beforeEach(() => {
      hubotMock = new HubotMock();
      civ2mock = new CIV2Mock();
      robot = new Robot(hubotMock);
    });

    afterEach(() => civ2mock.restore());

    describe('Chat', () => {
      describe('Release stoic', () => {
        it('should call civ2.release', async () =>
          expectCiv2CommandCall(
            'release stoic 123',
            [{ command: 'release', expectedArgs: ['123', true] }],
            [{ method: 'reply', args: ['Release in progress.'] }]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('release stoic 123', [{ command: 'release', expectedArgs: ['123', true] }]));
      });

      describe('Rollback stoic', () => {
        it('should call civ2.release', async () =>
          expectCiv2CommandCall(
            'rollback stoic 123',
            [{ command: 'release', expectedArgs: ['123', false] }],
            [{ method: 'reply', args: ['Rollback in progress.'] }]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('rollback stoic 123', [{ command: 'release', expectedArgs: ['123', false] }]));
      });

      describe('Create feature instance', () => {
        it('should call civ2.createFeatureCluster', async () =>
          expectCiv2CommandCall(
            'create feature instance toto/pipo',
            [{ command: 'createFeatureCluster', expectedArgs: ['toto/pipo'] }],
            [{ method: 'reply', args: ['Creation in progress.'] }]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error(
            'create feature instance toto/pipo',
            [{ command: 'createFeatureCluster', expectedArgs: ['toto/pipo'] }],
            'send'
          ));
      });

      describe('Destroy feature instance', () => {
        it('should call civ2.destroyFeatureCluster', async () =>
          expectCiv2CommandCall(
            'destroy feature instance toto/pipo',
            [{ command: 'destroyFeatureCluster', expectedArgs: ['toto/pipo'] }],
            [{ method: 'reply', args: ['Destruction in progress.'] }]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error(
            'destroy feature instance toto/pipo',
            [{ command: 'destroyFeatureCluster', expectedArgs: ['toto/pipo'] }],
            'send'
          ));
      });

      describe('Branch status checking', () => {
        it('should call civ2.getBranchInformation', async () =>
          expectCiv2CommandCall(
            'branch status toto/pipo',
            [{ command: 'getBranchInformation', expectedArgs: ['toto/pipo', 'John Doe'] }],
            [
              { method: 'reply', args: ['Checking branch toto/pipo...'] },
              { method: 'reply', args: ['SPY:getBranchInformation'] },
            ]
          ));
      });

      describe('PR creation', () => {
        it('should create pr creation and report status with default parameters', async () =>
          expectCiv2CommandCall(
            'create pull requests toto/pipo',
            [
              { command: 'createPRs', expectedArgs: ['toto/pipo', 'John Doe', 'master', { draft: true }] },
              { command: 'getBranchInformation', expectedArgs: ['toto/pipo', 'John Doe'] },
            ],
            [
              { method: 'reply', args: ['Creating PRs for branch toto/pipo...'] },
              { args: ['SPY:createPRs\nSPY:getBranchInformation'], method: 'reply' },
            ]
          ));

        it('should create pr creation and report status with specific target', async () =>
          expectCiv2CommandCall(
            'create pull requests toto/pipo to my-base',
            [
              { command: 'createPRs', expectedArgs: ['toto/pipo', 'John Doe', 'my-base', { draft: true }] },
              { command: 'getBranchInformation', expectedArgs: ['toto/pipo', 'John Doe'] },
            ],
            [
              { method: 'reply', args: ['Creating PRs for branch toto/pipo...'] },
              { args: ['SPY:createPRs\nSPY:getBranchInformation'], method: 'reply' },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('create pull requests toto/pipo', [
            { command: 'createPRs', expectedArgs: ['toto/pipo', 'John Doe', 'master', { draft: true }] },
          ]));
      });

      describe('PR merge', () => {
        it('should merge PRs', async () =>
          expectCiv2CommandCall(
            'merge pull requests toto/pipo',
            [{ command: 'mergePRs', expectedArgs: ['toto/pipo', 'John Doe'] }],
            [
              { method: 'reply', args: ['Merging PRs for branch toto/pipo...'] },
              { args: ['SPY:mergePRs'], method: 'reply' },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('merge pull requests toto/pipo', [
            { command: 'mergePRs', expectedArgs: ['toto/pipo', 'John Doe'] },
          ]));
      });

      describe('PR close', () => {
        it('should close PRs', async () =>
          expectCiv2CommandCall(
            'close pull requests toto/pipo',
            [{ command: 'closePRs', expectedArgs: ['toto/pipo', 'John Doe'] }],
            [
              { method: 'reply', args: ['Closing PRs for branch toto/pipo...'] },
              { args: ['SPY:closePRs'], method: 'reply' },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('close pull requests toto/pipo', [
            { command: 'closePRs', expectedArgs: ['toto/pipo', 'John Doe'] },
          ]));
      });

      describe('Branch deletion', () => {
        it('should delete branch', async () =>
          expectCiv2CommandCall(
            'delete branch toto/pipo',
            [{ command: 'deleteBranches', expectedArgs: ['toto/pipo', 'John Doe'] }],
            [
              { method: 'reply', args: ['Deleting branch toto/pipo...'] },
              { args: ['SPY:deleteBranches'], method: 'reply' },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('delete branch toto/pipo', [
            { command: 'deleteBranches', expectedArgs: ['toto/pipo', 'John Doe'] },
          ]));
      });

      describe('Link update', () => {
        it('should update PR description', async () =>
          expectCiv2CommandCall(
            'update links toto/pipo',
            [{ command: 'updatePRsDescriptions', expectedArgs: ['toto/pipo', 'John Doe'] }],
            [
              { method: 'reply', args: ['Updating links for branch toto/pipo...'] },
              { args: ['SPY:updatePRsDescriptions'], method: 'reply' },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('update links toto/pipo', [
            { command: 'updatePRsDescriptions', expectedArgs: ['toto/pipo', 'John Doe'] },
          ]));
      });

      describe('Instance update', () => {
        it('should trigger instance update with default args', async () =>
          expectCiv2CommandCall(
            'update instance pouet',
            [{ command: 'updateInstance', expectedArgs: ['pouet', undefined, undefined] }],
            [
              {
                method: 'reply',
                args: ['Instance <pouet|pouet> on "undefined" is updating to version "SPY:updateInstance"'],
              },
            ]
          ));

        it('should trigger instance update with specific env', async () =>
          expectCiv2CommandCall(
            'update instance pouet on shiny environment',
            [{ command: 'updateInstance', expectedArgs: ['pouet', 'shiny', undefined] }],
            [
              {
                method: 'reply',
                args: ['Instance <pouet|pouet> on "shiny" is updating to version "SPY:updateInstance"'],
              },
            ]
          ));

        it('should trigger instance update with specific env and version', async () =>
          expectCiv2CommandCall(
            'update instance pouet on shiny environment to version ultimate',
            [{ command: 'updateInstance', expectedArgs: ['pouet', 'shiny', 'ultimate'] }],
            [
              {
                method: 'reply',
                args: ['Instance <pouet|pouet> on "shiny" is updating to version "SPY:updateInstance"'],
              },
            ]
          ));

        it('should notify in an error occurs', async () =>
          expectCiv2Error('update instance pouet on shiny environment to version ultimate', [
            { command: 'updateInstance', expectedArgs: ['pouet', 'shiny', 'ultimate'] },
          ]));
      });

      // HELPERS
      // -----------------------------------------------------------------------------

      async function expectCiv2CommandCall(message, expectedCommands, expectedCalls) {
        const inspector = await hubotMock.say(message);
        for (const { command, expectedArgs } of expectedCommands) {
          const errMsg = `Expected call to '${command}' with arguments [${expectedArgs.join(',')}]`;
          expect(civ2Commands[command].calledOnceWithExactly(...expectedArgs), errMsg).to.equal(true);
        }

        expect(inspector.calls).to.deep.equal(expectedCalls);
      }

      async function expectCiv2Error(message, expectedCommands, replyMethod = 'reply') {
        expectedCommands.map(({ command }) => civ2mock.setFailure(command));

        const inspector = await hubotMock.say(message);

        for (const { command, expectedArgs } of expectedCommands) {
          const errMsg = `Expected call to '${command}' with arguments [${expectedArgs.join(',')}]`;
          expect(civ2Commands[command].calledOnceWithExactly(...expectedArgs), errMsg).to.equal(true);
        }

        const expectedReponse = 'Sorry, something went wrong: Oops';
        const lastMessage = inspector.calls[inspector.calls.length - 1];
        expect(lastMessage).to.deep.equal({ method: replyMethod, args: [expectedReponse] });
      }
    });

    // -----------------------------------------------------------------------------
    // ROUTER HANDLERS
    // -----------------------------------------------------------------------------

    describe('Router', () => {
      describe('GH webhook', () => {
        it('should declare a github webhook route', () => {
          expect(hubotMock._routes[0].route).to.equal('/hubot/civ2/github-webhook');
        });

        it('should ignore wehbhooks not about PRs', async () => {
          const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', {});
          expect(response).to.equal('OK');
        });

        describe('Merge', () => {
          const DEFAULT_MERGE_PAYLOAD = {
            id: '123',
            action: 'closed',
            pull_request: {
              head: { ref: 'feature/toto', repo: { name: 'my-repo' } },
              base: { ref: 'master' },
              merged: true,
            },
          };

          it('should detect a merge payload', mergePayloadTestFactory());

          const iconsByType = {
            feature: ':gift: ',
            bug: ':ladybug: ',
            fix: ':ladybug: ',
            chore: ':wrench: ',
            poc: ':test_tube: ',
            pipo: '',
          };

          for (const [kind, icon] of Object.entries(iconsByType)) {
            it('should detect a feature merge payload', mergePayloadTestFactory(kind, icon));
          }

          it('should report failures in the deletion phase', async () => {
            civ2mock.setFailure('deleteBranch');
            const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_MERGE_PAYLOAD);
            expect(civ2Commands.deleteBranch.calledOnceWithExactly('my-repo', 'feature/toto')).to.equal(true);
            expect(hubotMock._messageRoom).to.deep.equal([
              {
                msg: 'An error occured while deleting branch "feature/toto" (Oops).',
                channel: '#testing-ci',
              },
            ]);
            expect(response).to.equal('Error');
            expect(hubotMock._statusCode).to.equal(500);
          });

          it('should report failures in the cluster destruction phase', async () => {
            civ2mock.setFailure('destroyFeatureCluster');
            const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_MERGE_PAYLOAD);
            expect(civ2Commands.deleteBranch.calledOnceWithExactly('my-repo', 'feature/toto')).to.equal(true);
            expect(civ2Commands.destroyFeatureCluster.calledOnceWithExactly('feature/toto')).to.equal(true);
            expect(hubotMock._messageRoom).to.deep.equal([
              {
                channel: '#testing-ci',
                msg:
                  '<https://github/com/sutoiku/my-repo/branches|Branch feature/toto> of <https://github/com/sutoiku/my-repo|my-repo> was merged into master, I deleted it.',
              },
              {
                channel: '#testing-ci',
                msg: 'An error occured while triggering destruction of feature cluster "feature/toto" (Oops).',
              },
            ]);
            expect(response).to.equal('Error');
            expect(hubotMock._statusCode).to.equal(500);
          });

          // HELPERS
          // -----------------------------------------------------------------------------

          function mergePayloadTestFactory(kind = 'feature', icon = ':gift: ') {
            return async () => {
              const mergePayload = JSON.parse(JSON.stringify(DEFAULT_MERGE_PAYLOAD));
              mergePayload.pull_request.head.ref = kind + '/toto';

              const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', mergePayload);
              expect(civ2Commands.deleteBranch.calledOnceWithExactly('my-repo', kind + '/toto')).to.equal(true);
              expect(civ2Commands.destroyFeatureCluster.calledOnceWithExactly(kind + '/toto')).to.equal(true);
              expect(hubotMock._messageRoom).to.deep.equal([
                {
                  channel: '#testing-ci',
                  msg: `<https://github/com/sutoiku/my-repo/branches|Branch ${kind}/toto> of <https://github/com/sutoiku/my-repo|my-repo> was merged into master, I deleted it.`,
                },
                {
                  channel: '#release-candidates',
                  msg: `${icon}Branch \`${kind}/toto\` was merged into \`master\`.`,
                },
              ]);
              expect(response).to.equal('OK');
            };
          }
        });

        describe('Open', () => {
          const DEFAULT_OPEN_PAYLOAD = {
            id: '123',
            action: 'opened',
            pull_request: {
              head: { ref: 'feature/toto', repo: { name: 'my-repo' } },
              base: { ref: 'master' },
              merged: false,
            },
          };

          it('should detect an open payload', async () => {
            const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_OPEN_PAYLOAD);
            expect(civ2Commands.commentPtReferences.calledOnceWithExactly('feature/toto')).to.equal(true);
            expect(hubotMock._messageRoom).to.deep.equal([]);
            expect(response).to.equal('OK');
          });

          it('should report failures', async () => {
            civ2mock.setFailure('commentPtReferences');
            const response = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_OPEN_PAYLOAD);
            expect(civ2Commands.commentPtReferences.calledOnceWithExactly('feature/toto')).to.equal(true);
            expect(hubotMock._messageRoom).to.deep.equal([
              {
                msg: 'An error occured while looking for references in "feature/toto": Error: Oops',
                channel: '#testing-ci',
              },
            ]);
            expect(response).to.equal('Error');
            expect(hubotMock._statusCode).to.equal(500);
          });

          it('should fire only once per branch', async () => {
            const response1 = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_OPEN_PAYLOAD);
            expect(civ2Commands.commentPtReferences.calledOnceWithExactly('feature/toto')).to.equal(true);
            expect(hubotMock._messageRoom).to.deep.equal([]);
            expect(response1).to.equal('OK');

            civ2mock.reset();
            hubotMock.reset();

            const response2 = await hubotMock.httpCall('/hubot/civ2/github-webhook', DEFAULT_OPEN_PAYLOAD);
            expect(civ2Commands.commentPtReferences.called).to.equal(false);
            expect(hubotMock._messageRoom).to.deep.equal([]);
            expect(response2).to.equal(null);
          });
        });
      });

      describe('Health', () => {
        it('should declare a health route', () => {
          expect(hubotMock._routes[3].route).to.equal('/hubot/health');
        });

        it('should respond OK', async () => {
          const response = await hubotMock.httpCall('/hubot/health', {});
          expect(response).to.equal('OK');
        });
      });
    });
  });
});

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

class CIV2Mock {
  constructor() {
    this._originals = {};

    this._mockAllMethods();
  }

  get originals() {
    return this._originals;
  }

  reset() {
    this.restore();
    this._mockAllMethods();
  }

  restore() {
    for (const [methodName, fn] of Object.entries(this._originals)) {
      civ2Commands[methodName] = fn;
    }
  }

  setFailure(methodName) {
    civ2Commands[methodName] = new sinon.stub().throws(new Error('Oops'));
  }

  _mockAllMethods() {
    for (const [methodName, fn] of Object.entries(civ2Commands)) {
      this._originals[methodName] = fn;
      civ2Commands[methodName] = new sinon.stub().returns('SPY:' + methodName);
    }
  }
}
class MessageMock {
  constructor(match) {
    this._calls = [];
    this._match = match;
  }

  get message() {
    return { user: { name: 'John Doe' } };
  }

  get match() {
    return this._match;
  }

  get calls() {
    return this._calls;
  }

  send(...args) {
    this._calls.push({ method: 'send', args });
  }

  reply(...args) {
    this._calls.push({ method: 'reply', args });
  }
}
class HubotMock {
  constructor() {
    this._router = {
      get: this._get.bind(this),
      post: this._post.bind(this),
      status: this._status.bind(this),
      send: this._send.bind(this),
    };

    this.reset();
    this._routes = [];
  }

  get router() {
    return this._router;
  }

  reset() {
    this._hear = [];
    this._respond = [];
    this._messageRoom = [];
    this._response = null;
    this._statusCode = null;
  }

  hear(regex, callback) {
    this._hear.push({ regex, callback });
  }

  respond(regex, callback) {
    this._respond.push({ regex, callback });
  }

  messageRoom(channel, msg) {
    this._messageRoom.push({ channel, msg });
  }

  _post(route, callback) {
    this._routes.push({ route, callback });
  }

  _get(route, callback) {
    this._routes.push({ route, callback });
  }

  _send(payload) {
    if (this._response) {
      throw new Error('Already responded (payload)');
    }

    this._response = payload;
  }

  _status(code) {
    if (this._statusCode) {
      throw new Error('Already responded (code)');
    }

    this._statusCode = code;
    return this._router;
  }

  async say(message) {
    for (const { regex, callback } of this._hear) {
      const match = message.match(regex);
      if (match) {
        const messageMock = new MessageMock(match);
        await callback(messageMock);
        return messageMock;
      }
    }
  }

  async httpCall(route, payload) {
    const handler = this._getRouteHandler(route);
    await handler(
      { body: { payload: JSON.stringify(payload) } },
      {
        send: this._router.send.bind(this),
        status: this._router.status.bind(this),
      }
    );
    return this._response;
  }

  _getRouteHandler(expectedRoute) {
    for (const { route, callback } of this._routes) {
      if (route === expectedRoute) {
        return callback;
      }
    }

    throw new Error(`No handler found for route '${expectedRoute}'`);
  }
}
