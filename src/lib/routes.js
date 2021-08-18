const crypto = require('crypto');
const civ2 = require('./civ2-commands');
const { log } = require('./utils');

const SHARED_SIGNATURE = 'a]DzwfrtvHg4mxxgCjZQJGCXvH';

exports.createPr = async function(req, res) {
  if (!req.body) {
    log('No payload in create-pr request');
    return res.status(400).send('Payload is mandatory');
  }

  log('Received payload:', req.body);
  const { branch, author = 'magic', sign, target = 'master', dryrun, draft = true } = req.body;
  if (!validateBranchRequest(branch, sign, res, 'createPR')) {
    return;
  }

  try {
    const message = dryrun
      ? `Request OK, would create PRs on branch "${branch}", author "${author}", target "${target}"`
      : await civ2.createPRs(branch, author, target, { draft });
    res.send(message);
  } catch (err) {
    res.status(400).send(err.message + '\n' + err.stack);
  }
};

exports.announcePRs = async function(req, res) {
  const { text, sign, branch, dryrun } = req.body;
  if (!validateBranchRequest(branch, sign, res, 'announce')) {
    return;
  }

  const message = dryrun
    ? `Request OK, would announce "${text}" on branch "${branch}"`
    : await civ2.announcePRs(branch, text);
  res.send(message);
  log(message);
};

function validateBranchRequest(branch, sign, res, operation) {
  if (!branch || !sign) {
    log('Incomplete payload in ' + operation);
    res.status(400).send('BranchName and Signature are mandatory');
    return false;
  }

  if (!checkSignature(branch, sign)) {
    log('Incorrect signature');
    res.status(400).send('Incorrect signature.');
    return;
  }

  return true;
}

function checkSignature(branchName, signature) {
  const str = branchName + '|' + SHARED_SIGNATURE;
  const shasum = crypto.createHash('sha1');
  shasum.update(str);
  const hash = shasum.digest('hex');

  log(`Comparing hashes for "${branchName}": expected "${hash}", received "${signature}"`);

  return hash === signature;
}
