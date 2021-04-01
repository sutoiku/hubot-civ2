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
//   create feature instance <branch> - Creates a cluster on the specified branch
//   destroy feature instance <branch> - Destroys the cluster of the specified branch
//   branch status <branch name> - Displays information on branch and PRs
//   create pull requests <branch name> - Create PRs to master on repos with the specified branch
//   create pull requests <branch name> to <base> - Create PRs to <base> on repos with the specified branch
//   merge pull requests <branch name> - Merge all PRs on the specified branch
//   close pull requests <branch name> - Close all PRs on the specified branch
//   delete branch <branch name> - Delete this branch on all repos. PRs must be closed first.
//
// Notes:
//   <optional notes required for the script>
//
// Author:
//   Yan[@sutoiku.com>]

const civ2 = require('./lib/civ2-commands');
const routes = require('./lib/routes');
const gh = require('./lib/github');
const aws = require('./lib/aws');
const { log, error } = require('./lib/utils');

const REPLICATED_STABLE_CHANNEL = 'Stable';
const DEMO = { url: 'demo.stoic.cc', name: 'demo' };
const DEFAULT_ROOM = '#testing-ci';
const MAX_PRDATE = 1000 * 60 * 5;

module.exports = function(robot) {
  const parsedPrs = new Map();

  // -----------------------------------------------------------------------------
  // MESSAGE TRIGGERS
  // -----------------------------------------------------------------------------

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
        error(ex);
        msg.reply(`Sorry, something went wrong: ${ex.message}`);
      }
    });
  }

  robot.hear(
    /release stoic (\S*)/,
    responderFactory(async (msg) => {
      const tag = msg.match[1];
      await civ2.release(tag, true);
      msg.reply('Release in progress.');
    })
  );

  robot.hear(
    /rollback stoic (\S*)/,
    responderFactory(async (msg) => {
      const tag = msg.match[1];
      await civ2.release(tag, false);
      msg.reply('Rollback in progress.');
    })
  );

  robot.hear(
    /create feature instance (\S*)/,
    responderFactory(async (msg) => {
      const branch = msg.match[1];
      await civ2.createFeatureCluster(branch);
      msg.reply('Creation in progress.');
    }, 'send')
  );

  robot.hear(
    /destroy feature instance (\S*)/,
    responderFactory(async (msg) => {
      const branch = msg.match[1];
      await civ2.destroyFeatureCluster(branch);
      msg.reply('Destruction in progress.');
    }, 'send')
  );

  robot.hear(
    /branch status (\S*)/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      msg.reply(`Checking branch ${branchName}...`);
      const message = await civ2.getBranchInformation(branchName, msg.message.user.name);
      msg.reply(message);
    })
  );

  robot.hear(
    /my github token is (\S*)/,
    responderFactory(async (msg) => {
      const user = msg.message.user.name;
      const key = msg.match[1];
      await aws.storeUserKey(user, key, 'github');
      msg.reply('Thanks. I will keep is safe.');
    })
  );

  robot.hear(
    /what is my github token \?/,
    responderFactory(async (msg) => {
      const user = msg.message.user.name;
      const key = await aws.getUserKey(user, 'github');
      const snippet = key.substring(0, 2);
      msg.reply(`It starts with "${snippet}" but I won't divulgate more.`);
    })
  );

  robot.hear(
    /create pull requests (\S*)( to (\S*))?/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      const target = msg.match[3] || 'master';

      msg.reply(`Creating PRs for branch ${branchName}...`);
      const message = await civ2.createPRs(branchName, msg.message.user.name, target, { draft: true });
      const status = await civ2.getBranchInformation(branchName, msg.message.user.name);
      msg.reply(`${message}\n${status}`);
    })
  );

  robot.hear(
    /merge pull requests (\S*)/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      msg.reply(`Merging PRs for branch ${branchName}...`);
      const message = await civ2.mergePRs(branchName, msg.message.user.name);
      msg.reply(message);
    })
  );

  robot.hear(
    /close pull requests (\S*)/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      msg.reply(`Closing PRs for branch ${branchName}...`);
      const message = await civ2.closePRs(branchName, msg.message.user.name);
      msg.reply(message);
    })
  );

  robot.hear(
    /delete branch (\S*)/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      msg.reply(`Deleting branch ${branchName}...`);
      const message = await civ2.deleteBranches(branchName, msg.message.user.name);
      msg.reply(message);
    })
  );

  robot.hear(
    /update links (\S*)/,
    responderFactory(async (msg) => {
      const branchName = msg.match[1];
      msg.reply(`Updating links for branch ${branchName}...`);
      const message = await civ2.updatePRsDescriptions(branchName, msg.message.user.name);
      msg.reply(message);
    })
  );

  robot.hear(
    /update instance (\S*)( on (\S*) environment)?( to version (\S*))?/,
    responderFactory(async (msg) => {
      const [, instance, , env, , version] = msg.match;
      const targetVersion = await civ2.updateInstance(instance, env, version);
      msg.reply(`Instance <${instance}|${instance}> on "${env}" is updating to version "${targetVersion}"`);
    })
  );

  robot.hear(
    /Publicly release (\S*)/,
    responderFactory(async (msg) => {
      const releaseSource = msg.match[1];
      const messages = [];
      const targetVersion = await findVersion(releaseSource);
      messages.push(`Version on instance ${releaseSource} is ${targetVersion}.`);

      await Promise.all([
        civ2.updateInstance(DEMO.url, DEMO.name, targetVersion),
        civ2.replicatedPromotion(REPLICATED_STABLE_CHANNEL, targetVersion)
      ]);

      messages.push(
        `Instance <https://${DEMO.url}|${DEMO.name}> is updating to version "${targetVersion}"`,
        `Replicated "${REPLICATED_STABLE_CHANNEL}" channel gets updated.`
      );

      msg.reply(messages.join('\n'));
    })
  );

  // ROUTER TRIGGERS
  // -----------------------------------------------------------------------------

  robot.router.post('/hubot/civ2/github-webhook', async (req, res) => {
    const data = req.body.payload != null ? JSON.parse(req.body.payload) : req.body;
    const pr = gh.getPR(data);

    if (!pr) {
      return res.send('OK');
    }

    switch (inferGHPrAction(pr)) {
      case 'merged':
        return handlePrMerge(pr, res);
      case 'opened':
        return handlePrOpening(pr, res);
    }
  });

  robot.router.post('/hubot/civ2/create-pr', routes.createPr);

  robot.router.post('/hubot/civ2/announce-pr', routes.announcePRs);

  // WBEHOOK HANDLERS
  // -----------------------------------------------------------------------------

  async function handlePrMerge(pr, res) {
    const { repo, branch, base } = pr;
    log('Merged PR', repo, branch);

    if (
      (await tryDeleteBranch(repo, branch, base, robot, res)) &&
      (await tryDestryoFeatureCluster(branch, robot, res))
    ) {
      return res.send('OK');
    }
  }

  async function handlePrOpening(pr, res) {
    if (parsedPrs.has(pr.branch)) {
      return true;
    }

    try {
      parsedPrs.set(pr.branch, Date.now());
      await civ2.commentPtReferences(pr.branch);
      cleanParsedPrs(parsedPrs);
      return res.send('OK');
    } catch (err) {
      error(err);
      robot.messageRoom(DEFAULT_ROOM, `An error occured while looking for PT references in "${pr.branch}": ${err}`);
      res.status(500).send('Error');
    }
  }

  // HELPERS
  // -----------------------------------------------------------------------------

  function responderFactory(func, respondMethod = 'reply') {
    return async (msg) => {
      try {
        await func(msg);
      } catch (err) {
        respondToError(err, msg, respondMethod);
      }
    };
  }
};

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function inferGHPrAction(pr) {
  const { action, merged } = pr;
  return action === 'closed' && merged === true ? 'merged' : action;
}

async function tryDestryoFeatureCluster(branch, robot, res) {
  const destroyFn = () => civ2.destroyFeatureCluster(branch);
  const destroyErrMsg = `triggering destruction of feature cluster "${branch}"`;
  return tryAndNotifyErr(destroyFn, destroyErrMsg, robot, res);
}

async function tryDeleteBranch(repo, branch, base, robot, res) {
  const deleteFn = async () => {
    await civ2.deleteBranch(repo, branch);
    const message = `<https://github/com/sutoiku/${repo}/branches|Branch ${branch}> of <https://github/com/sutoiku/${repo}|${repo}> was merged into ${base}, I deleted it.`;
    robot.messageRoom(DEFAULT_ROOM, message);
  };

  return tryAndNotifyErr(deleteFn, `deleting branch "${branch}"`, robot, res);
}

async function tryAndNotifyErr(func, errMsg, robot, res) {
  try {
    await func();
    return true;
  } catch (ex) {
    robot.messageRoom(DEFAULT_ROOM, `An error occured while ${errMsg} (${ex.message}).`);
    res.status(500).send('Error');
    return false;
  }
}

function cleanParsedPrs(parsedPrs) {
  const now = Date.now();
  for (const pr of parsedPrs.keys()) {
    const prDate = parsedPrs.get(pr);
    if (now - prDate > MAX_PRDATE) {
      parsedPrs.delete(pr);
    }
  }
}

function respondToError(ex, msg, respondMethod) {
  error(ex);
  msg[respondMethod](`Sorry, something went wrong: ${ex.message}`);
}

async function findVersion(source) {
  if (['dev', 'demo', 'latest'].includes(source)) {
    return civ2.getLatestVersion(source);
  }

  return source.startsWith('0.') ? source : null;
}
