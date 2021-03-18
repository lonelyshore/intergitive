'use strict'

const vcs = require('./repo-vcs-implement')
const eol = require('../common/text-eol')
const readonly = require('../common/readonly')

const RepoStorage = require('./repo-storage/repo-storage')
const GitStorage = require('./repo-storage/repo-git-storage')
const ArchiveStorage = require('./repo-storage/repo-archive-storage')

const hiddenCtor = Symbol('hiddenCtor')

/**
 * Enum
 * @readonly
 * @enum {number}
 */
let STORAGE_TYPE = {
  GIT: Symbol('git'),
  ARCHIVE: Symbol('archive'),

  toString (type) {
    switch (type) {
      case this.GIT:
        return 'git'
      case this.ARCHIVE:
        return 'archive'
      default:
        return 'unkown'
    }
  }
}

STORAGE_TYPE = readonly.wrap(STORAGE_TYPE) // wrap STORAGE_TYPE after initialization to trick auto completion

/**
 *
 * @param {STORAGE_TYPE} storageType
 * @returns {RepoStorage}
 */
function createStorage (storageType, isAutoCrlf) {
  switch (storageType) {
    case STORAGE_TYPE.GIT:
      return new GitStorage(isAutoCrlf)

    case STORAGE_TYPE.ARCHIVE:
      return new ArchiveStorage()

    default:
      throw new Error(`Unhandled storage type ${storageType}`)
  }
}

exports.STORAGE_TYPE = STORAGE_TYPE

exports.RepoCheckpointManager = class RepoCheckpointManager {
  static create (monitoredPath, checkpointStorePath, storeName, isRemote, storageType, isCrLf) {
    const ret = new RepoCheckpointManager()
    return ret[hiddenCtor](monitoredPath, checkpointStorePath, storeName, isRemote, storageType, isCrLf || eol.isCrLf())
      .then(() => ret)
  }

  constructor () {
  }

  [hiddenCtor] (monitoredPath, checkpointStorePath, storeName, isRemote, storageType, isCrLf) {
    this.backend = new vcs.RepoVersionControl(checkpointStorePath, createStorage(storageType, isCrLf), isCrLf)
    return this.backend.setTarget(monitoredPath, storeName, isRemote)
  }

  backup (checkpointName) {
    return this.backend.backup(checkpointName, false)
  }

  restore (checkpointName) {
    return this.backend.restore(checkpointName, false)
  }
}

exports.RepoReferenceManager = class RepoReferenceManager {
  static create (monitoredPath, referenceStorePath, storeName, isRemote, storageType, isCrLf) {
    const ret = new RepoReferenceManager()
    return ret[hiddenCtor](monitoredPath, referenceStorePath, storeName, isRemote, storageType, isCrLf || eol.isCrLf())
      .then(() => ret)
  }

  constructor () {
  }

  [hiddenCtor] (monitoredPath, referenceStorePath, storeName, isRemote, storageType, isCrLf) {
    this.backend = new vcs.RepoVersionControl(referenceStorePath, createStorage(storageType, isCrLf), isCrLf)
    return this.backend.setTarget(monitoredPath, storeName, isRemote)
  }

  /**
     *
     * @param {string} referenceName
     */
  equivalent (referenceName) {
    return this.backend.diffWithTemplate(referenceName)
  }

  restore (referenceName) {
    return this.backend.restore(referenceName, true)
  }

  contains (referenceName) {
    return this.backend.contains(referenceName)
  }
}

exports.RepoReferenceMaker = class RepoReferenceMaker {
  static create (sourcePath, referenceStorePath, storeName, isRemote, storageType, isCrLf) {
    const ret = new RepoReferenceMaker()
    return ret[hiddenCtor](sourcePath, referenceStorePath, storeName, isRemote, storageType, isCrLf || eol.isCrLf())
      .then(() => ret)
  }

  [hiddenCtor] (sourcePath, referenceStorePath, storeName, isRemote, storageType, isCrLf) {
    this.backend = new vcs.RepoVersionControl(referenceStorePath, createStorage(storageType, isCrLf), isCrLf)
    return this.backend.setTarget(sourcePath, storeName, isRemote)
  }

  save (referenceName) {
    return this.backend.backup(referenceName, true)
  }
}
