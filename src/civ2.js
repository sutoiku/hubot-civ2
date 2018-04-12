// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   deploy to civ1 <optional tag> - deploys the specified image:tag to civ1. (default tag : release-candidate)
//   deploy to dockercloud <optional tag> - deploys the specified image:tag to docker. (default tag : release-candidate)
//   deploy to kubernetes <optional tag> - deploys the specified image:tag to docker. (default tag : release-candidate)
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]
const civ2 = require("./civ2-commands");
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
};
