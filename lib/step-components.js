'use strict';

const elaborate = require('./component/elaborate');
const illustrate = require('./component/illustrate');
const instruct = require('./component/instruct');
const verifyInput = require('./component/verify-input');
const verifyRepo = require('./component/verify-repo');
const autoPlay = require('./component/autoplay');
const blockable = require('./component/blockable');
const checkpoint = require('./component/checkpoint');
const repeatableUserActions = require('./component/repeatable-user-actions');

exports = module.exports = {
    elaborate: elaborate,
    illustrate: illustrate,
    instruct: instruct,
    'verify-input': verifyInput,
    'verify-repo': verifyRepo,
    'auto-play': autoPlay,
    'repeatable-user-actions': repeatableUserActions,
    blockable: blockable,
    checkpoint: checkpoint,
};