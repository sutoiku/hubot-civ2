// Description
//   A hubot scripts that pilots civ2 tasks
//
// Configuration:
//   HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL
//
// Commands:
//   deploy to civ1 <optional tag> - deploys the specified image:tag to civ1. (default tag : release-candidate)
//   deploy to dockercloud <optional tag> - deploys the specified image:tag to docker. (default tag : release-candidate)
//   deploy to kubernetes <optional tag> - deploys the specified image:tag to kubernetes dev cluster. (default tag : release-candidate)
//   release stoic <version> - releases <version> in the wild.
//   update instance <instance domain> on <env> environment
//   update instance <instance domain> on <env> environment to version <version>
//   rollback stoic <version> - rollback to stoic <version>
//   archive <repository> <branch>
//   create feature instance <branch> - Creates a cluster on the specified branch
//   destroy feature instance <branch> - Destroys the cluster of the specified branch
//   branch status <branch name> - Displays information on branch and PRs
//   create pull requests <branch name> - Create PRs to master on repos with the specified branch
//   create pull requests <branch name> to <base> - Create PRs to <base> on repos with the specified branch
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]
const civ2 = require('./lib/civ2-commands');
const gh = require('./lib/github');

module.exports = function(robot) {
  const targets = [
    { trigger: 'civ1', method: civ2.deployV1 },
    { trigger: 'dockercloud', method: civ2.deployDocker },
    { trigger: 'kubernetes', method: civ2.deployK8s }
  ];
  for (const target of targets) {
    const re = new RegExp(`deploy to ${target.trigger} ?(\S*)`);
    robot.hear(re, async (msg) => {
      const tag = msg.match[1] || 'release-candidate';
      try {
        await target.method(tag);
        const tagTxt = tag ? `tag ${tag}` : 'default tag';
        msg.reply(`The deployment of ${tagTxt} to ${target.trigger} is scheduled.`);
      } catch (ex) {
        console.error(ex);
        msg.reply(`Sorry, something went wrong: ${ex.message}`);
      }
    });
  }

  robot.hear(/release stoic (\S*)/, async (msg) => {
    const tag = msg.match[1];
    try {
      await civ2.release(tag, true);
      msg.reply('Release in progress.');
    } catch (ex) {
      respondToError(ex, msg);
    }
  });

  robot.hear(/rollback stoic (\S*)/, async (msg) => {
    const tag = msg.match[1];
    try {
      await civ2.release(tag, false);
      msg.reply('Rollback in progress.');
    } catch (ex) {
      respondToError(ex, msg);
    }
  });

  robot.hear(/update yourself please/, async (msg) => {
    try {
      await civ2.updateBot();
      msg.reply("I'm now refreshing myself, master.");
    } catch (ex) {
      respondToError(ex, msg);
    }
  });

  robot.respond(/archive (\S*) (\S*)/, async (msg) => {
    const repo = msg.match[1],
      branch = msg.match[2];
    console.log(`repo: ${repo}, branch:${branch}`);
    try {
      const body = await civ2.archive(repo, branch);
      const bodyContent = JSON.parse(body);
      if (bodyContent === 'ok') {
        const message = `<https://github/com/sutoiku/${repo}/branches|Branch> ${branch} is now renamed archive/${branch}.`;
        return msg.send(message);
      }
      const message = `Hum, something unexpected happened. You'd better <https://github.com/sutoiku/${repo}/branches|check on github>.`;
      return msg.send(message);
    } catch (ex) {
      replyError(ex, msg);
    }
  });

  robot.hear(/create feature instance (\S*)/, async (msg) => {
    const branch = msg.match[1];
    try {
      await civ2.createFeatureCluster(branch);
      msg.reply('Creation in progress.');
    } catch (ex) {
      replyError(ex, msg);
    }
  });

  robot.hear(/destroy feature instance (\S*)/, async (msg) => {
    const branch = msg.match[1];
    try {
      await civ2.destroyFeatureCluster(branch);
      msg.reply('Destruction in progress.');
    } catch (ex) {
      replyError(ex, msg);
    }
  });

  robot.hear(/branch status (\S*)/, async (msg) => {
    const branchName = msg.match[1];
    msg.reply(`Checking branch ${branchName}...`);
    const message = await civ2.getBranchInformation(branchName);
    msg.reply(message);
  });

  robot.hear(/create pull requests (\S*)( to (\S*))?/, async (msg) => {
    const branchName = msg.match[1];
    const target = msg.match.length > 3 ? msg.match[3] : 'master';
    msg.reply(`Creating PRs for branch ${branchName}...`);
    //TODO assign the PR to creator ?
    const message = await civ2.createPRs(branchName, msg.message.user.name, target);
    const status = await civ2.getBranchInformation(branchName);
    msg.reply(`${message}\n${status}`);
  });

  robot.hear(/update instance (\S*)( on (\S*) environment)?( to version (\S*))?/, async (msg) => {
    const [, instance, , env, , version] = msg.match;
    try {
      const targetVersion = await civ2.updateInstance(instance, env, version);
      msg.reply(`Instance <${instance}|${instance}> is updating to version "${targetVersion}"`);
    } catch (err) {
      respondToError(err, msg);
    }
  });

  robot.router.post('/hubot/civ2/github-webhook', async (req, res) => {
    const room = '#testing-ci';
    const data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
    const prMerge = gh.getPRMerge(data);

    if (!prMerge) {
      return res.send('OK');
    }

    const { repo, branch, id, base } = prMerge;

    if (base !== 'master' && base !== 'staging') {
      const msg = `The PR ${repo}#${id} was not forked from master or staging. Won't delete ${branch}.`;
      robot.messageRoom(room, msg);
      return console.log(msg);
    }

    console.log("Merged PR", repo, branch);

    try {
      await civ2.deleteBranch(repo, branch);
      const message = `<https://github/com/sutoiku/${repo}/branches|Branch ${branch}> of <https://github/com/sutoiku/${repo}|${repo}> was merged into ${base}, I deleted it.`;
      return robot.messageRoom(room, message);
    } catch (ex) {
      robot.messageRoom(room, `An error occured (${ex.message}).`);
      return res.statusCode(500).send('Error');
    }
  });
};

function respondToError(ex, msg) {
  console.error(ex);
  msg.reply(`Sorry, something went wrong: ${ex.message}`);
}

function replyError(ex, msg) {
  console.error(ex);
  msg.send(`An error occured (${ex.message}).`);
}
