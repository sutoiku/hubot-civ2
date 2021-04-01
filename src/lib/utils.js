const IS_TEST = process.env.NODE_ENV === 'test';

exports.log = function log(msg) {
  if (!IS_TEST) {
    console.log(msg);
  }
};
exports.error = function log(msg) {
  if (!IS_TEST) {
    console.error(msg);
  }
};
