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
    robot.hear(re, msg => {
      const tag = msg.match[1] || "release-candidate";
      target
        .method(tag)
        .then(response => {
          const tagTxt = tag ? `tag ${tag}` : "default tag";
          msg.reply(
            `The deployment of ${tagTxt} to ${target.trigger} is scheduled.`
          );
        })
        .catch(err => {
          msg.reply(`Sorry, something went wrong: ${err.message}`);
        });
    });
  }
  robot.hear(/release stoic (\S*)/, msg => {
    const tag = msg.match[1];
    civ2
      .release(tag, true)
      .then(() => {
        msg.reply("Release in progress.");
      })
      .catch(err => {
        msg.reply(`Sorry, something went wrong: ${err.message}`);
      });
  });

  robot.hear(/rollback stoic (\S*)/, msg => {
    const tag = msg.match[1];
    civ2
      .release(tag, false)
      .then(() => {
        msg.reply("Rollback in progress.");
      })
      .catch(err => {
        msg.reply(`Sorry, something went wrong: ${err.message}`);
      });
  });

  robot.hear(/update yourself please/, msg => {
    civ2
      .updateBot()
      .then(() => {
        msg.reply("I'm now refreshing myself, master.");
      })
      .catch(err => {
        msg.reply(`Sorry, something went wrong: ${err.message}`);
      });
  });

  robot.respond(/archive (\S*) (\S*)/, msg => {
    const repo = msg.match[1],
      branch = msg.match[2];
    console.log(`repo: ${repo}, branch:${branch}`);
    civ2
      .archive(repo, branch)
      .then(body => {
        const bodyContent = JSON.parse(body);
        if (bodyContent === "ok") {
          return msg.send(
            `<https://github/com/sutoiku/${repo}/branches|Branch> ${branch} is now renamed archive/${branch}.`
          );
        }
        msg.send(
          `Hum, something unexpected happened. You'd better <https://github.com/sutoiku/${repo}/branches|check on github>.`
        );
      })
      .catch(err => {
        msg.send(
          `An error occured while renaming ${branch} to archive/${branch}. ${
            err.message
          }`
        );
      });
  });

  robot.router.post("/hubot/civ2/github-webhook", (req, res) => {
    const room = "#testing-ci";
    const data =
      req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
    const prMerge = gh.getPRMerge(data);
    if (prMerge) {
      civ2
        .archive(prMerge.repo, prMerge.branch)
        .then(body => {
          const bodyContent = JSON.parse(body);
          if (bodyContent === "ok") {
            return robot.messageRoom(
              room,
              `<https://github/com/sutoiku/${prMerge.repo}/branches|Branch> ${prMerge.branch} is now archived as archive/${prMerge.branch}.`
            );
          }
          robot.messageRoom(
            room,
            `Hum, something unexpected happened. You'd better <https://github.com/sutoiku/${prMerge.repo}/branches|check on github>.`
          );
        })
        .catch(err => {
          msg.send(
            `An error occured while renaming branch ${prMerge.branch} of ${prMerge.repo} into archive/${prMerge.branch}.
             ${err.message}`
          );
        });
    }
    return res.send("OK");
  });
};
