// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   deploy to civ1 - deploys the latest "release-candidate" image to civ1
//   deploy to civ1 <tag> - deploys a specifig image to civ1
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]
const civ2 = require('./civ2-commands');
module.exports = function(robot) {

  return robot.hear(/deploy to civ1 ?(\S*)/, (msg) => {
    const tag = msg.match[1]||'release-candidate';
    civ2.deployV1(tag).then((response) => {
      const tagTxt = tag ? `tag ${tag}` : 'default tag';
      msg.reply(`The deployment of ${tagTxt} is scheduled (queued #${response}).`);
    }).catch((err) => {
      msg.reply(`Sorry, something went wrong: ${err.message}`);
    });
  });
};
