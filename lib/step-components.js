'use strict';

const elaborate = require('./component/elaborate');
const illustrate = require('./component/illustrate');
const instruct = require('./component/instruct');
const verifyInput = require('./component/verifyInput');
const autoPlay = require('./component/autoplay');
const blockable = require('./component/blockable');

exports = module.exports = {
    elaborate: elaborate,
    illustrate: illustrate,
    instruct: instruct,
    'verify-input': verifyInput,
    'auto-play': autoPlay,
    blockable: blockable,
};