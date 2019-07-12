const chai = require('chai');
const sinon = require('sinon');
const Helper = require('hubot-test-helper');
const helper = new Helper('./../src/civ2.js');

chai.use(require('sinon-chai'));

const { expect } = chai;

describe('hubot integration', () => {
  describe('register', () => {
    beforeEach(function() {
      this.robot = {
        respond: sinon.spy(),
        hear: sinon.spy(),
        router: {
          post: sinon.spy()
        }
      };

      require('../src/civ2')(this.robot);
    });

    it('registers 13 listeners', function() {
      expect(this.robot.hear).to.have.callCount(13);
    });
    it('registers 1 responder', function() {
      expect(this.robot.respond).to.have.callCount(1);
    });

    it('registers 1 webhook', function() {
      expect(this.robot.router.post).to.have.callCount(1);
    });

    it('registers an archive responder', function() {
      expect(this.robot.respond.getCall(0).args[0].toString()).to.equal('/archive (\\S*) (\\S*)/');
    });

    it('registers a civ1 listener', function() {
      expect(this.robot.hear.getCall(0).args[0].toString()).to.equal('/deploy to civ1 ?(S*)/');
    });
    it('registers a dockercloud listener', function() {
      expect(this.robot.hear.getCall(1).args[0].toString()).to.equal('/deploy to dockercloud ?(S*)/');
    });
    it('registers a kubernetes listener', function() {
      expect(this.robot.hear.getCall(2).args[0].toString()).to.equal('/deploy to kubernetes ?(S*)/');
    });
    it('registers a release listener', function() {
      expect(this.robot.hear.getCall(3).args[0].toString()).to.equal('/release stoic (\\S*)/');
    });
    it('registers a rollback listener', function() {
      expect(this.robot.hear.getCall(4).args[0].toString()).to.equal('/rollback stoic (\\S*)/');
    });

    it('registers a self-update', function() {
      expect(this.robot.hear.getCall(5).args[0].toString()).to.equal('/update yourself please/');
    });

    it('registers a cluster creation listener', function() {
      expect(this.robot.hear.getCall(6).args[0].toString()).to.equal('/create feature instance (\\S*)/');
    });

    it('registers a cluster destruction listener', function() {
      expect(this.robot.hear.getCall(7).args[0].toString()).to.equal('/destroy feature instance (\\S*)/');
    });
  });
});
