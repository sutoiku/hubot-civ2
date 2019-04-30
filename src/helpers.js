const sutoikuers = require('./sutoikuers.json');

exports.getUserFromSlackLogin = (slackLogin) => {
  return sutoikuers.find((it) => it.slack === slackLogin);
};
