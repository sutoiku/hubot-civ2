const AWS = require('aws-sdk');
const { AWS_KMS_KEY, AWS_BOT_BUCKET, AWS_BUILD_BUCKET } = process.env;

const awsOptions = { region: 'us-west-1' };
const kms = new AWS.KMS(awsOptions);

exports.storeMergeInformation = async function (repo, branch, merge_commit_sha) {
  return createS3Client()
    .putObject({ Bucket: process.env.AWS_BUILD_BUCKET, Key: `Merges/${repo}/${merge_commit_sha}`, Body: branch })
    .promise();
};

exports.storeUserKey = async function (user, key, kind) {
  const encrypted = await encrypt(key);

  return createS3Client()
    .putObject({ Bucket: AWS_BOT_BUCKET, Key: user + '-' + kind, Body: encrypted })
    .promise();
};

exports.getUserKey = async function (user, kind) {
  if (!AWS_BOT_BUCKET || !AWS_KMS_KEY) {
    return null;
  }

  try {
    const { Body } = await createS3Client()
      .getObject({ Bucket: AWS_BOT_BUCKET, Key: user + '-' + kind })
      .promise();
    return decrypt(Body);
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      return null;
    }

    throw err;
  }
};

async function encrypt(Plaintext) {
  return new Promise((resolve, reject) => {
    const params = { KeyId: AWS_KMS_KEY, Plaintext };
    kms.encrypt(params, (err, data) => (err ? reject(err) : resolve(data.CiphertextBlob)));
  });
}

async function decrypt(CiphertextBlob) {
  return new Promise((resolve, reject) => {
    const params = { CiphertextBlob };
    kms.decrypt(params, (err, data) => (err ? reject(err) : resolve(data.Plaintext.toString())));
  });
}

function createS3Client() {
  return new AWS.S3(awsOptions);
}
