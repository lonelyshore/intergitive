'use strict';

const elaborate = require('./component/elaborate');
const illustrate = require('./component/illustrate');
const instruct = require('./component/instruct');
const verifyInput = require('./component/verifyInput');

exports = module.exports = {
    elaborate: elaborate,
    illustrate: illustrate,
    instruct: instruct,
    'verify-input': verifyInput,
};