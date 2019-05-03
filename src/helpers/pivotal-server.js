'use strict';
const https = require('https');
const debug = require('debug')('portal:pivotal:server');

class PivotalServer {
  constructor(token, hostname = 'www.pivotaltracker.com') {
    this.hostname = hostname;
    this.token = token;
  }

  get(path) {
    debug.enabled && debug(`getting ${path}`);
    const headers = getHeaders(this.token);

    const params = {
      method: 'GET',
      hostname: this.hostname,
      path,
      headers
    };
    return request(params);
  }

  put(path, data, options) {
    const method = 'PUT';
    const headers = getHeaders(this.token, { 'Content-Type': 'application/json' });
    const params = {
      method,
      hostname: this.hostname,
      path,
      headers
    };
    debug.enabled && debug(`PUT ${path} ${JSON.stringify(data)}`);
    return request(params, data, options);
  }
}

module.exports = PivotalServer;

async function request(params, data, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : undefined;
    if (options.dryrun) {
      debug.enabled && debug(`DRYRUN - would have sent request ${JSON.stringify(params)} with payload ${payload}`);
      return resolve(`Dry-Run - ${JSON.stringify(params)}`);
    }
    https.request(params, (res) => parseHttpRes(res, resolve, reject)).end(payload);
  });
}

function getHeaders(token, additionalHeaders = {}) {
  return Object.assign({}, { 'X-TrackerToken': token }, additionalHeaders);
}

function parseHttpRes(res, resolve, reject) {
  const chunks = [];
  res.on('error', reject);
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const res = JSON.parse(Buffer.concat(chunks).toString());
    if (res && res.error) {
      return reject(res.error);
    }
    return resolve(res);
  });
}
