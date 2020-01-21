'use strict';

const descriptive = require('./step/descriptive');
const verifyInput = require('./step/verify-input');
const verifyRepo = require('./step/verify-repo');
const blockingExecution = require('./step/blocking-execution');
const checkpoint = require('./step/checkpoint');
const repeatableUserActions = require('./step/repeatable-user-actions');
const completeLevel = require('./step/complete-level');

exports = module.exports = {
    descriptive: descriptive, 
    'verify-input': verifyInput,
    'verify-repo': verifyRepo,
    'blocking-execution': blockingExecution,
    'repeatable-user-actions': repeatableUserActions,
    checkpoint: checkpoint,
    'complete-level': completeLevel
};