const rp = require('request-promise');
const Jenkins = require('jenkins');
const ghApi = require('./github-api');
const Jira = require('./jira');

const REQUIRED_STATUS = new Set(['linting', 'unit-tests', 'stoic-assemble', 'stoic-integration-tests']);
const REVIEW_ICONS = { PENDING: '🟡', COMMENTED: '⚪', APPROVED: '✔️', REQUEST_CHANGES: '❌' };

// -----------------------------------------------------------------------------
// DEPLOYMENT
// -----------------------------------------------------------------------------

exports.deployV1 = function (tag) {
  return buildJob('Deployment/ci-v1', tag);
};

exports.deployDocker = function (tag) {
  return buildJob('Release/marcus-to-docker-cloud', tag);
};

exports.deployK8s = function (tag) {
  return buildJob('Release/marcus-to-kubernetes', tag);
};

exports.updateInstance = async function (receivedDomain, env, requestedVersion) {
  const domain = stripHttp(receivedDomain);
  const version = requestedVersion || (await exports.getLatestVersion());
  const instanceName = `k8s-${env}.stoic.cc`;
  const namespace = domain.replace(/\./g, '-');
  const release = getHelmReleaseName(domain);

  await buildJob('Release/marcus-to-kubernetes', undefined, { namespace, instanceName, env, version, release, domain });
  return version;
};

// -----------------------------------------------------------------------------
// RELEASE
// -----------------------------------------------------------------------------

exports.release = function (tag, UpdatePivotalAndGitHub) {
  const additionalParameters = UpdatePivotalAndGitHub ? { UpdatePivotalAndGitHub } : undefined;
  return buildJob('Release/global-release', tag, additionalParameters);
};

exports.triggerJiraRelease = async function (projectKey, releaseName) {
  const jira = Jira.initialize();
  const version = await jira.createNewVersion(projectKey, releaseName);
  const issues = await jira.listIssuesToRelease(projectKey);

  await jira.setIssuesVersion(issues, version.id);
  await jira.releaseVersion(version.id);
  const releaseUrl = `https://${jira.host}/projects/${projectKey}/versions/${version.id}/tab/release-report-warnings`;
  return { releaseName, releaseUrl, versionId: version.id, version };
};

// -----------------------------------------------------------------------------
// MAINTENANCE
// -----------------------------------------------------------------------------

exports.updateBot = function () {
  return buildJob('Chore/hubot/stoic-hubot/master');
};

// -----------------------------------------------------------------------------
// BRANCHES
// -----------------------------------------------------------------------------

exports.archive = function (repo, branch) {
  const { CI_API_ROOT } = getEnv();
  const encodedBranch = encodeURIComponent(branch);
  const url = `${CI_API_ROOT}archive/${repo}/${encodedBranch}`;
  return rp(url, getAuthHeaders());
};

exports.deleteBranches = async function (branchName, userName) {
  const deleted = await ghApi.deleteBranches(branchName, userName);
  const deletedList = deleted.map((it) => '`' + it + '`').join(',');
  return `Delete branches on ${deletedList}.`;
};

exports.deleteBranch = function (repo, branch) {
  return ghApi.deleteBranch(repo, branch);
};

exports.createFeatureCluster = (FEATURE) => {
  return buildJob('Chore/feature-clusters/create', undefined, { FEATURE });
};

exports.destroyFeatureCluster = (FEATURE) => {
  return buildJob('Chore/feature-clusters/destroy', undefined, { FEATURE });
};

exports.getBranchInformation = async function (branchName, userName) {
  try {
    const status = await ghApi.getAllReposBranchInformation(branchName, userName);
    return await formatBranchInformation(branchName, status);
  } catch (error) {
    console.error(error);
    return `Error: ${error.message}`;
  }
};

exports.listRepos = async function () {
  try {
    const repos = await ghApi.listRepos();
    return '# Existing repositories\n- ' + repos.join('\n- ');
  } catch (error) {
    console.error(error);
    return `Error: ${error.message}`;
  }
};

// -----------------------------------------------------------------------------
// PULL REQUESTS
// -----------------------------------------------------------------------------

exports.createPRs = async function (branchName, userName, targetBase, options) {
  const created = await ghApi.createMissingPrs(branchName, userName, targetBase, options);

  const strCreated = getPrlist(created, false);
  const strError = getPrlist(created, true);
  const message = [];
  if (strCreated) {
    message.push(`Pull Request created on ${strCreated}.`);
  }

  if (strError) {
    message.push(`Error on ${strCreated}.`);
  }

  return message.join();
};

exports.mergePRs = async function (branchName, userName) {
  const merged = await ghApi.mergePRs(branchName, userName);
  const mergedList = merged.map((it) => '`' + it + '`').join(',');
  return `Merging PRs on ${mergedList}.`;
};

exports.closePRs = async function (branchName, userName) {
  const closed = await ghApi.closePRs(branchName, userName);
  const closedList = closed.map((it) => '`' + it + '`').join(',');
  return `Closed PRs on ${closedList}.`;
};

exports.announcePRs = async function (brancName, text) {
  const announced = await ghApi.announcePRs(brancName, text);
  const announcedList = announced.map((it) => '`' + it + '`').join(',');
  return `Announced on ${announcedList}.`;
};

exports.updatePRsDescriptions = async function (branchName, userName) {
  return ghApi.updatePRsDescriptions(branchName, userName);
};

exports.commentPtReferences = async function (branchName) {
  return ghApi.commentPtReferences(branchName);
};

exports.getLatestVersion = async function (instance = 'latest') {
  const suffix = instance === 'dev' ? 'com' : 'cc';
  const url = `https://${instance}.stoic.${suffix}/health`;
  const healthBody = await rp(url);
  const { version } = JSON.parse(healthBody);
  return version;
};

exports.replicatedPromotion = async function (channel, version) {
  return buildJob('Deployment/promote-replicated', undefined, { channel, version, releaseNotes: '' });
};

function getPrlist(created, withError) {
  if (!created) {
    return '';
  }

  return Object.keys(created)
    .filter((it) => (withError ? !!created[it].error : !created[it].error))
    .map((it) => '`' + it + '`')
    .join(',');
}

function buildJob(name, tag, additionalParameters) {
  const baseUrl = getBaseUrl();
  const jenkins = new Jenkins({ baseUrl, crumbIssuer: true, promisify: true });
  let options = name;
  if (tag !== undefined) {
    options = { name: name, parameters: { tag } };
  }
  if (additionalParameters !== undefined) {
    if (typeof options !== 'object') {
      options = { name: options, parameters: {} };
    }
    Object.assign(options.parameters, additionalParameters);
  }

  return jenkins.job.build(options);
}

function getBaseUrl() {
  const { HUBOT_JENKINS_AUTH, HUBOT_JENKINS_URL } = process.env;

  return HUBOT_JENKINS_URL.includes('://')
    ? HUBOT_JENKINS_URL.replace('://', `://${HUBOT_JENKINS_AUTH}@`)
    : `https://${HUBOT_JENKINS_AUTH}@${HUBOT_JENKINS_URL}`;
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

async function formatBranchInformation(branchName, status) {
  const result = [];
  const issueLink = await ghApi.getIssueLinkFromBranchName(branchName);

  if (issueLink) {
    result.push(issueLink);
  }

  if (Object.keys(status).length === 0) {
    return `Branch "${branchName}" was not found on the product repositories`;
  }

  let mergeable = true;
  for (const [repo, data] of Object.entries(status)) {
    const repoReport = getRepoReport(repo, branchName, data);
    mergeable = mergeable && repoReport.mergeable;
    result.push(repoReport.message);
  }

  const mergeableMessage = mergeable
    ? "\n\nIt seems to be mergeable. It looks like you're done with the PR feedback comments, just ask me `merge pull requests " +
      branchName +
      '` and I will do it for you.'
    : '';
  return result.join('\n') + mergeableMessage;
}

function getRepoReport(repoName, branchName, data) {
  const prStatus = getPRStatus(data);
  const repoUrl = `https://github.com/sutoiku/${repoName}/tree/${branchName}`;

  const statusReport = getStatusReport(data);
  const statusMessage = '*Statuses*: ' + statusReport.message;

  const { message: reviewsMessage, approved } = getReviewReport(data);

  return {
    mergeable: statusReport.mergeable && approved,
    message: ` * <${repoUrl}|${repoName}> : ${prStatus} - ${statusMessage} - ${reviewsMessage}`,
  };
}

function getReviewReport({ pr, reviews }) {
  if (!pr) {
    return { message: '', approved: false };
  }

  if (!reviews) {
    return 'Not reviewed yet';
  }

  const reviewCount = countReviewByState(reviews);
  let approved = false;
  const messageParts = [];
  for (const [state, count] of Object.entries(reviewCount)) {
    const icon = REVIEW_ICONS[state] || '';
    approved = approved || state === 'APPROVED';
    messageParts.push(`${icon} ${count} ${state.toLowerCase()}`);
  }
  return { approved, message: `*Reviews*: ${messageParts.join(',')}` };
}

function countReviewByState(reviews) {
  const states = {};
  for (const { state } of reviews) {
    states[state] = states[state] || 0;
    states[state]++;
  }

  return states;
}

function getStatusReport({ status }) {
  const statuses = keepLatestRequiredStatus(status);

  let okStatus = 0;
  const nonOkStatus = {};
  for (const [context, { state }] of Object.entries(statuses)) {
    if (state === 'success') {
      okStatus++;
    } else {
      nonOkStatus[state] = nonOkStatus[state] || [];
      nonOkStatus[state].push(context);
    }
  }
  const totalStatus = Object.keys(statuses).length;
  const nonOkMessage = formatStatusMessage(nonOkStatus);

  return {
    message: okStatus === totalStatus ? ':white_check_mark:' : `${okStatus}/${totalStatus} are OK ${nonOkMessage}`,
    mergeable: okStatus === totalStatus,
  };
}

function formatStatusMessage(nonOkStatus) {
  if (Object.keys(nonOkStatus).length === 0) {
    return '';
  }

  const nonOkMessageParts = [];
  for (const [name, contexts] of Object.entries(nonOkStatus)) {
    nonOkMessageParts.push(`${name}: ${contexts.map((it) => '`' + it + '`').join(',')}`);
  }
  return `(${nonOkMessageParts.join(',')})`;
}

function keepLatestRequiredStatus(statuses) {
  const result = {};

  for (const stat of statuses) {
    const { context, updated_at } = stat;
    if (!REQUIRED_STATUS.has(context)) {
      continue;
    }

    if (!result[context] || new Date(updated_at) > new Date(result[context].updated_at)) {
      result[context] = stat;
    }
  }

  for (const requiredStatus of REQUIRED_STATUS) {
    if (!result[requiredStatus]) {
      result[requiredStatus] = { state: 'pending' };
    }
  }

  return result;
}

function getPRStatus({ pr }) {
  if (pr) {
    const { number, state, html_url } = pr;
    return `<${html_url}|PR #${number} (${state})>`;
  }
  return 'no PR';
}

function getHelmReleaseName(domain) {
  const [subdomain] = domain.split('.');
  return 'stoic-' + subdomain;
}

function getEnv() {
  const { CI_API_ROOT, CI_API_AUTH: token } = process.env;
  return { CI_API_ROOT, CI_API_AUTH: token };
}

function getAuthHeaders() {
  const { token } = getEnv();
  const headers = { Authorization: `Basic ${token}` };
  return { headers };
}

function getReviewsStatus({ reviews }) {
  const statuses = reviews
    .map((it) => it.state)
    .reduce((acc, it) => {
      if (!acc[it]) {
        acc[it] = 0;
      }
      acc[it]++;
      return acc;
    }, {});

  const report = [];
  for (const [stat, count] of Object.entries(statuses)) {
    report.push(`${count}/${reviews.length} ${stat}`);
  }

  const mergeable = !!statuses.APPROVED && Object.keys(statuses).length == 1;
  const message = report.join(',');
  return { message, mergeable };
}

function stripHttp(domain) {
  if (!domain.startsWith('http')) {
    return domain;
  }
  return domain.substr(domain.indexOf('//') + 2);
}
