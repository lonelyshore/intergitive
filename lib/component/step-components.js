'use strict';

const elaborate = require('./step/elaborate');
const illustrate = require('./step/illustrate');
const instruct = require('./step/instruct');
const verifyInput = require('./step/verify-input');
const verifyRepo = require('./step/verify-repo');
const autoPlay = require('./step/autoplay');
const checkpoint = require('./step/checkpoint');
const repeatableUserActions = require('./step/repeatable-user-actions');
const completeLevel = require('./step/complete-level');

exports = module.exports = {
    elaborate: elaborate,
    illustrate: illustrate,
    instruct: instruct,
    'verify-input': verifyInput,
    'verify-repo': verifyRepo,
    'auto-play': autoPlay,
    'repeatable-user-actions': repeatableUserActions,
    checkpoint: checkpoint,
    'complete-level': completeLevel
};