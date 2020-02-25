const crypto = require('crypto');
const civ2 = require('./civ2-commands');

const SHARED_SIGNATURE = 'a]DzwfrtvHg4mxxgCjZQJGCXvH';

exports.createPr = async function(req, res) {
  if (!req.body) {
    console.log('No payload in create-pr request');
    return res.status(400).send('Payload is mandatory');
  }

  console.log('Received payload:' + req.body);

  const { branch, author = 'magic', sign, target = 'master', dryrun, draft = true } = req.body;
  console.log('SIGN', sign);
  if (!branch || !sign) {
    console.log('Incomplete payload in create pr request: ' + req.body);
    return res.status(400).send('BranchName and Signature are mandatory');
  }

  if (!checkSignature(branch, sign)) {
    console.log('Incorrect signature');
    return res.status(400).send('Incorrect signature.');
  }

  const message = dryrun
    ? `Request OK, would create PRs on branch "${branch}", author "${author}", target "${target}"`
    : await civ2.createPRs(branch, author, target, { draft });
  res.send(message);
  console.log(message);
};

function checkSignature(branchName, signature) {
  const str = branchName + '|' + SHARED_SIGNATURE;
  const shasum = crypto.createHash('sha1');
  shasum.update(str);
  const hash = shasum.digest('hex');

  console.log(`Comparing hashes for "${branchName}": expected "${hash}", received "${signature}"`);

  return hash === signature;
}
