'use strict';

const IS_TEST = process.env.NODE_ENV === 'test';

exports.log = function log(...args) {
  if (!IS_TEST) {
    console.log(...args);
  }
};

exports.logError = function logError(...args) {
  if (!IS_TEST) {
    console.error(...args);
  }
};
