'use strict'

const readonly = require('./readonly')

let REPO_TYPE = {
  LOCAL: Symbol('local'),
  REMOTE: Symbol('remote')
}

REPO_TYPE = readonly.wrap(REPO_TYPE)

class RepoVcsSetup {
  /**
     *
     * @param {String} workingPath
     * @param {String} referenceStoreName
     * @param {String} checkpointStoreName
     * @param {REPO_TYPE} repoType
     */
  constructor (workingPath, referenceStoreName, checkpointStoreName, repoType) {
    this.workingPath = workingPath
    this.referenceStoreName = referenceStoreName
    this.checkpointStoreName = checkpointStoreName
    this.repoType = repoType
  }
}

class Level {
  /**
     *
     * @param {Array<Step>} steps
     * @param {Object} repoVcsSetups
     */
  constructor (steps, repoVcsSetups) {
    this.klass = 'Level'
    this.repoVcsSetups = repoVcsSetups
    this.steps = steps
  }
}

module.exports.REPO_TYPE = REPO_TYPE
module.exports.Level = Level
module.exports.RepoVcsSetup = RepoVcsSetup
