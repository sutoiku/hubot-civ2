// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   deploy to civ1 <optional tag> - deploys the specified image:tag to civ1. (default tag : release-candidate)
//   deploy to docker <optional tag> - deploys the specified image:tag to docker. (default tag : release-candidate)
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]
const civ2 = require('./civ2-commands');
module.exports = function(robot) {
  robot.hear(/deploy to civ1 ?(\S*)/, (msg) => {
    const tag = msg.match[1]||'release-candidate';
    civ2.deployV1(tag).then((response) => {
      const tagTxt = tag ? `tag ${tag}` : 'default tag';
      msg.reply(`The deployment of ${tagTxt} to CIV1 is scheduled.`);
    }).catch((err) => {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    });
  });

  robot.hear(/deploy to docker ?(\S*)/, (msg) => {
    const tag = msg.match[1]||'release-candidate';
    civ2.deployDocker(tag).then((response) => {
      const tagTxt = tag ? `tag ${tag}` : 'default tag';
      msg.reply(`The deployment of ${tagTxt} to Docker is scheduled.`);
    }).catch((err) => {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    });
  });
};
