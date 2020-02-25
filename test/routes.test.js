const { expect } = require('chai');
const sinon = require('sinon');
const routes = require('../src/lib/routes');
const civ2 = require('../src/lib/civ2-commands');

describe('Routes', () => {
  let responseMock;
  let spies = {};

  beforeEach(() => {
    responseMock = new ResponseMock();
    spies.createPRs = sinon.stub(civ2, 'createPRs');
  });

  afterEach(() => sinon.restore());

  describe('Create PR', () => {
    it('should reject where there is no body', async () => {
      await routes.createPr({}, responseMock);
      responseMock.expect('Payload is mandatory', 400);
    });

    it('should reject when branch is missing', async () => {
      await routes.createPr({ body: 'pouet' }, responseMock);
      responseMock.expect('BranchName and Signature are mandatory', 400);
    });

    it('should reject when signature is missing', async () => {
      await routes.createPr({ body: { branc: 'fix/my-mess' } }, responseMock);
      responseMock.expect('BranchName and Signature are mandatory', 400);
    });

    it('should reject when signature is incorrect', async () => {
      await routes.createPr({ body: { branch: 'fix/my-mess', sign: 'elvis' } }, responseMock);
      responseMock.expect('Incorrect signature.', 400);
    });

    it('should implement dry-run', async () => {
      await routes.createPr(
        { body: { branch: 'fix/my-mess', sign: 'd1eaaf73a1625689487e09be3f6bf925831722b2', dryrun: true } },
        responseMock
      );
      responseMock.expect('Request OK, would create PRs on branch "fix/my-mess", author "magic", target "master"');
    });

    it('should correctly call the createPr method, using draft by default', async () => {
      const body = { branch: 'fix/my-mess', sign: 'd1eaaf73a1625689487e09be3f6bf925831722b2' };
      await routes.createPr({ body }, responseMock);
      sinon.assert.calledWith(spies.createPRs, 'fix/my-mess', 'magic', 'master', { draft: true });
    });

    it('should correctly call the createPr method, using specific draft status', async () => {
      const body = { branch: 'fix/my-mess', sign: 'd1eaaf73a1625689487e09be3f6bf925831722b2', draft: false };
      await routes.createPr({ body }, responseMock);
      sinon.assert.calledWith(spies.createPRs, 'fix/my-mess', 'magic', 'master', { draft: false });
    });
  });
});

class ResponseMock {
  constructor() {
    this.code = null;
    this.response = null;
  }

  status(code) {
    this.code = code;
    return this;
  }

  send(response) {
    this.response = response;
  }

  expect(response, code = null) {
    expect(this.response).to.equal(response);
    expect(this.code).to.equal(code);
  }
}
