'use strict'

/**
 *
 * folder layout:
 *   - storePath
 *     - archive-store  // where the repository archives located
 *       - revisionName.zip
 *       - anotherRevision.zip
 *       - ...
 *     - index-store  // where serialized indices located
 *       - revisionName
 *       - anotherRevision
 *       - ...
 *     - cache  // the temporary path for comparing saved repositories
 *       - .git
 *       - files
 *     - CACHE_HEAD  // stores what is the currently checked out revision
 *
 */

const assert = require('assert')
const path = require('path')
const fs = require('fs-extra')

const zip = require('../simple-archive')

const RepoStorage = require('./repo-storage')
const readonlyWrap = require('../../common/readonly').wrap

class Props {
  constructor (storePath) {
    this.archiveStoreName = 'archives'
    this.auxStoreName = 'aux-store'
    this.indexName = 'index'
    this.configName = 'config'
    this.remoteSettingName = 'remoteSetting'
    this.cacheFolderName = 'cache'
    this.cacheRevisionLogName = 'CACHE_HEAD'
    this.storePath = storePath
  }

  get archiveStorePath () {
    return path.join(this.storePath, this.archiveStoreName)
  }

  get auxStorePath () {
    return path.join(this.storePath, this.auxStoreName)
  }

  get cacheFolderPath () {
    return path.join(this.storePath, this.cacheFolderName)
  }

  get cacheRevisionLogPath () {
    return path.join(this.storePath, this.cacheRevisionLogName)
  }

  getRevisionArchivePath (revisionName) {
    return path.join(this.archiveStorePath, revisionName) + '.zip'
  }

  getRevisionAuxPath (revisionName) {
    return path.join(this.auxStorePath, revisionName)
  }

  getRevisionIndexPath (revisionName) {
    return path.join(this.getRevisionAuxPath(revisionName), this.indexName)
  }

  getRevisionConfigPath (revisionName) {
    return path.join(this.getRevisionAuxPath(revisionName), this.configName)
  }

  getRevisionRemoteSettingPath (revisionName) {
    return path.join(this.getRevisionAuxPath(revisionName), this.remoteSettingName)
  }
}

/**
 * @inheritdoc
 */
exports = module.exports = class ArchiveRepoStorage extends RepoStorage {
  constructor () {
    super()

    this.storePath = ''
  }

  /**
     *
     * @param {String} storePath
     * @returns {Promise<void>}
     */
  setStorePath (storePath) {
    this.props = new Props(storePath)
    this.props = readonlyWrap(this.props)

    return fs.ensureDir(storePath)
      .then(() => {
        return fs.ensureDir(this.props.archiveStorePath)
      })
      .then(() => {
        return fs.ensureDir(this.props.auxStorePath)
      })
      .then(() => {
        return fs.ensureDir(this.props.cacheFolderPath)
      })
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} sourcePath
     * @param {Boolean} isSaveTemplate
     * @returns {Promise<void>}
     */
  saveLocal (revisionName, sourcePath, isSaveTemplate) {
    return this.saveRepo(revisionName, sourcePath, isSaveTemplate)
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} sourcePath
     * @returns {Promise<void>}
     */
  saveRemote (revisionName, sourcePath) {
    return this.saveRepo(revisionName, sourcePath, false)
  }

  saveRepo (revisionName, sourcePath, isSaveTemplate) {
    const archivePath = this.props.getRevisionArchivePath(revisionName)
    const auxStorePath = this.props.getRevisionAuxPath(revisionName)
    const serializedIndexPath = this.props.getRevisionIndexPath(revisionName)

    const localRepoConfigSubPath = '.git/config'

    return fs.exists(archivePath)
      .then(archiveExists => {
        if (archiveExists) {
          return fs.remove(archivePath)
        }
      })
      .then(() => {
        return fs.access(path.join(sourcePath, localRepoConfigSubPath))
          .then(() => {
            return [localRepoConfigSubPath]
          }, () => [])
          .then(nonArchivedFiles => {
            return zip.archivePathTo(
              sourcePath,
              archivePath,
              nonArchivedFiles
            )
          })
      })
      .then(() => fs.ensureDir(auxStorePath))
      .then(() => {
        return trySaveRemotePathSeparatedly(
          sourcePath,
          this.props.getRevisionConfigPath(revisionName),
          this.props.getRevisionRemoteSettingPath(revisionName),
          super.removeRemotePathsFromConfig,
          super.serializeRemoteSetting
        )
      })
      .then(() => {
        if (isSaveTemplate) {
          return fs.exists(serializedIndexPath)
            .then(indexExists => {
              if (indexExists) {
                return fs.remove(serializedIndexPath)
              }
            })
            .then(() => {
              return super.serializeIndex(
                sourcePath,
                serializedIndexPath
              )
            })
        }
      })

    function trySaveRemotePathSeparatedly (sourceRepoPath, savedConfigPath, savedRemoteSettingPath, removeRemotePathsFromConfig, serializeRemoteSetting) {
      const sourceLocalRepoConfigPath = path.join(sourceRepoPath, localRepoConfigSubPath)

      return fs.access(sourceLocalRepoConfigPath)
        .then(() => {
          return fs.copyFile(sourceLocalRepoConfigPath, savedConfigPath)
            .then(() => {
              return removeRemotePathsFromConfig(savedConfigPath)
            })
            .then(() => {
              return serializeRemoteSetting(sourceRepoPath, savedRemoteSettingPath)
            })
        }, () => {})
    }
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} destinationPath
     * @param {Boolean} isTEmplate
     * @returns {Promise<void>}
     */
  loadLocal (revisionName, destinationPath, isTemplate) {
    return this.loadRepo(revisionName, destinationPath, true)
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} destinationPath
     * @returns {Promise<void>}
     */
  loadRemote (revisionName, destinationPath) {
    return this.loadRepo(revisionName, destinationPath, true)
  }

  loadRepo (revisionName, destinationPath, isRebaseRemotePath) {
    const archivePath = this.props.getRevisionArchivePath(revisionName)
    return fs.exists(archivePath)
      .then(archiveExists => {
        assert(archiveExists, `Expect ${revisionName} is saved before loaded`)
      })
      .then(() => {
        return fs.emptyDir(destinationPath)
      })
      .then(() => {
        return zip.extractArchiveTo(
          archivePath,
          destinationPath
        )
      })
      .then(() => {
        const configFilePath = this.props.getRevisionConfigPath(revisionName)
        return fs.access(configFilePath)
          .then(() => {
            return fs.copyFile(configFilePath, path.join(destinationPath, '.git', 'config'))
              .then(() => {
                const remoteSettingPath = this.props.getRevisionRemoteSettingPath(revisionName)
                return fs.access(remoteSettingPath)
                  .then(() => {
                    return super.deserializeRemoteSetting(
                      destinationPath,
                      remoteSettingPath,
                      isRebaseRemotePath
                    )
                  }, () => {})
              })
          }, () => {})
      })
  }

  /**
     *
     * @param {String} revisionName
     * @returns {Promise<CacheInfo>} returns cachingPath and indexFilePath
     */
  loadLocalToCache (revisionName) {
    let serializedIndexEntries

    return Promise.resolve()
      .then(() => {
        assert(revisionName !== undefined)
      })
      .then(() => {
        return super.deserializeIndex(this.props.getRevisionIndexPath(revisionName))
          .then(result => {
            serializedIndexEntries = result
          })
      })
      .then(() => {
        return this.tryLoadRevisionIntoCache(revisionName)
      })
      .then(cachingPath => {
        return {
          cachingPath: cachingPath,
          serializedIndexEntries: serializedIndexEntries
        }
      })
  }

  loadRemoteToCache (revisionName) {
    return Promise.resolve()
      .then(() => {
        assert(revisionName !== undefined)
      })
      .then(() => {
        return this.tryLoadRevisionIntoCache(revisionName)
      })
  }

  contains (revisionName) {
    return fs.access(this.props.getRevisionArchivePath(revisionName))
      .then(() => true)
      .catch(() => false)
  }

  tryLoadRevisionIntoCache (revisionName) {
    const cachingLogPath = this.props.cacheRevisionLogPath
    const cachingPath = this.props.cacheFolderPath

    const loadLastCachedRevisionName = () => {
      return fs.exists(cachingLogPath)
        .then(cachingLogExists => {
          if (cachingLogExists) {
            return fs.readFile(cachingLogPath)
          } else {
            return undefined
          }
        })
    }

    const loadRevisionIntoCache = () => {
      return fs.emptyDir(cachingPath)
        .then(() => {
          return this.loadRepo(revisionName, cachingPath, false)
        })
        .then(() => {
          return fs.writeFile(cachingLogPath, revisionName)
        })
    }

    return loadLastCachedRevisionName()
      .then(cachedRevisionName => {
        if (cachedRevisionName === revisionName) {
          return cachingPath
        } else {
          return loadRevisionIntoCache()
            .then(() => {
              return cachingPath
            })
        }
      })
  }
}
