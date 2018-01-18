const chai = require('chai');
const sinon = require('sinon');
const Helper = require('hubot-test-helper')
const helper = new Helper('./../src/civ2.js')

chai.use(require('sinon-chai'));

const {
  expect
} = chai;

  describe("hubot integration", () => {
    describe('register', ()=>{


    beforeEach(function() {
      this.robot = {
        respond: sinon.spy(),
        hear: sinon.spy()
      };

      require('../src/civ2')(this.robot);
    });

    it('registers a hear listener', function() {
      expect(this.robot.hear).to.have.been.calledWith(/deploy to civ1 ?(\S*)/);
    });
  });

});
