const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));

const {
  expect
} = chai;

  describe("hubot integration", () => {
    beforeEach(function() {
      this.robot = {
        respond: sinon.spy(),
        hear: sinon.spy()
      };

      require('../src/civ2')(this.robot);
    });

    it('registers a hear listener', function() {
      expect(this.robot.hear).to.have.been.calledWith(/civ2 deploy-civ1/);
    });
});
