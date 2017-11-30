// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   civ2 deploy-civ1 - deploys the latest "preprod" image to civ1
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@<org>]
const civ2 = require('./civ2-commands');
module.exports = function(robot) {

  return robot.hear(/civ2 deploy-civ1/, (msg) => {
    civ2.deployV1().then((response) => {
      msg.reply(`OK, the deployment #${response} is in progress.`);
    }).catch((err) => {
      msg.reply('Sorry, something went wrong.')
    });
  });
};
