// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   deploy to civ1 <optional tag> - deploys the specified image:tag to civ1. (default tag : release-candidate)
//   deploy to dockercloud <optional tag> - deploys the specified image:tag to docker. (default tag : release-candidate)
//   deploy to kubernetes <optional tag> - deploys the specified image:tag to kuberentes dev cluster. (default tag : release-candidate)
//   release stoic <version> - releases <version> in the wild.
//   roolback stoic <version> - rollback to stoic >version>
//   archive <repository> <branch>
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]
const civ2 = require("./civ2-commands");
const gh = require("./github");

module.exports = function(robot) {
  const targets = [
    { trigger: "civ1", method: civ2.deployV1 },
    { trigger: "dockercloud", method: civ2.deployDocker },
    { trigger: "kubernetes", method: civ2.deployK8s }
  ];
  for (const target of targets) {
    const re = new RegExp(`deploy to ${target.trigger} ?(\S*)`);
    robot.hear(re, async msg => {
      const tag = msg.match[1] || "release-candidate";
      try {
        const response = await target.method(tag);
        const tagTxt = tag ? `tag ${tag}` : "default tag";
        msg.reply(
          `The deployment of ${tagTxt} to ${target.trigger} is scheduled.`
        );
      } catch (ex) {
        msg.reply(`Sorry, something went wrong: ${ex.message}`);
      }
    });
  }
  robot.hear(/release stoic (\S*)/, async msg => {
    const tag = msg.match[1];
    try {
      await civ2.release(tag, true);
      msg.reply("Release in progress.");
    } catch (ex) {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    }
  });

  robot.hear(/rollback stoic (\S*)/, async msg => {
    const tag = msg.match[1];
    try {
      await civ2.release(tag, false);
      msg.reply("Rollback in progress.");
    } catch (ex) {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    }
  });

  robot.hear(/update yourself please/, async msg => {
    try {
      await civ2.updateBot();
      msg.reply("I'm now refreshing myself, master.");
    } catch (ex) {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    }
  });

  robot.respond(/archive (\S*) (\S*)/, async msg => {
    const repo = msg.match[1],
      branch = msg.match[2];
    console.log(`repo: ${repo}, branch:${branch}`);
    try {
      const body = await civ2.archive(repo, branch);
      const bodyContent = JSON.parse(body);
      if (bodyContent === "ok") {
        const message = `<https://github/com/sutoiku/${repo}/branches|Branch> ${branch} is now renamed archive/${branch}.`;
        return respond(msg.send, message);
      }
      const message = `Hum, something unexpected happened. You'd better <https://github.com/sutoiku/${repo}/branches|check on github>.`;
      respond(msg.send, message);
    } catch (ex) {
      respond(msg.send, `An error occured (${ex.message}).`);
    }
  });

  robot.router.post("/hubot/civ2/github-webhook", async (req, res) => {
    const room = "#testing-ci";
    const data =
      req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
    const prMerge = gh.getPRMerge(data);
    if (!prMerge) {
      return res.send("OK");
    }
    try {
      const body = await civ2.archive(prMerge.repo, prMerge.branch);
      const bodyContent = JSON.parse(body);
      if (bodyContent === "ok") {
        const message = `<https://github/com/sutoiku/${
          prMerge.repo
        }/branches|Branch> ${prMerge.branch} of ${
          prMerge.repo
        } is now archived as archive/${prMerge.branch}.`;
        return respond(robot.messageRoom, message, room);
      }
      const message = `Hum, something unexpected happened. You'd better <https://github.com/sutoiku/${
        prMerge.repo
      }/branches|check on github>.`;
      return respond(robot.messageRoom, message, room);
    } catch (ex) {
      respond(robot.messageRoom, `An error occured (${ex.message}).`, room);
      return res.statusCode(500).send("Error");
    }
  });
};

function respond(responder, message, target) {
  if (target) {
    return reponder(target, message);
  }
  responder(message);
}
