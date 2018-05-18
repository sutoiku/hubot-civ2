const expect = require("chai").expect;
const gh = require("../src/github");
describe("github", () => {
  const payload = {
    action: "closed",
    pull_request: {
      head: {
        ref: "toto",
        repo: { name: "titi" }
      },
      merged: true
    }
  };

  it("identifies pr closings", () => {
    const prmessage = gh.getPRMerge(payload);
    expect(prmessage).to.equal("branch toto of titi can be archived now !");
  });
});
