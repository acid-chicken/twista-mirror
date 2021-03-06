/*
 * auth.js: Utilities for authenticating with multiple cloud providers
 *
 * (C) 2011-2012 Charlie Robbins, Ken Perkins, Ross Kukulinski & the Contributors.
 *
 */

var httpSignature = require('./http-signature')

var auth = exports;

auth.basic = function basicAuth(req) {
  var credentials = this.credentials
    || this.config.username + ':' + this.config.password;

  req.headers = req.headers || {};
  req.headers.authorization = [
    'Basic',
    new Buffer(credentials).toString('base64')
  ].join(' ');
};

// Add Account number for requests to rackspace API
auth.accountId = function (req) {
  req.headers = req.headers || {};
  if (this.config.accountNumber) {
    req.headers['x-auth-project-id'] = this.config.accountNumber;
  }
};

function signatureGenerator(sign) {
  return function signatureAuth(req, keys) {
    keys = keys || this.config;
    sign.call(this, req, {
      key: keys.key,
      keyId: keys.keyId
    });
  };
}

auth.httpSignature = signatureGenerator(httpSignature.sign);
