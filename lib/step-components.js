'use strict';

const elaborate = require('./component/elaborate');
const illustrate = require('./component/illustrate');
const instruct = require('./component/instruct');
const verifyInput = require('./component/verifyInput');
const verifyRepo = require('./component/verifyRepo');
const autoPlay = require('./component/autoplay');
const blockable = require('./component/blockable');
const checkpoint = require('./component/checkpoint');

exports = module.exports = {
    elaborate: elaborate,
    illustrate: illustrate,
    instruct: instruct,
    'verify-input': verifyInput,
    'verify-repo': verifyRepo,
    'auto-play': autoPlay,
    blockable: blockable,
    checkpoint: checkpoint,
};