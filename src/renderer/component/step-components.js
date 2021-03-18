'use strict'

const descriptive = require('./step/descriptive.vue').default
const verifyInput = require('./step/verify-input.vue').default
const verifyRepo = require('./step/verify-repo.vue').default
const blockingExecution = require('./step/blocking-execution.vue').default
const checkpoint = require('./step/checkpoint.vue').default
const repeatableUserActions = require('./step/repeatable-user-actions.vue').default
const completeLevel = require('./step/complete-level.vue').default

exports = module.exports = {
  descriptive: descriptive,
  'verify-input': verifyInput,
  'verify-repo': verifyRepo,
  'blocking-execution': blockingExecution,
  'repeatable-user-actions': repeatableUserActions,
  checkpoint: checkpoint,
  'complete-level': completeLevel
}
