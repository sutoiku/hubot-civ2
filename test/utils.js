'use strict';

exports.setVariables = function (variables) {
  const backups = {};
  for (const [key, value] of Object.entries(variables)) {
    backups[key] = process.env[key];
    process.env[key] = value;
  }

  return backups;
};

exports.resetVariables = function (backups = {}) {
  for (const [key, value] of Object.entries(backups)) {
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};
