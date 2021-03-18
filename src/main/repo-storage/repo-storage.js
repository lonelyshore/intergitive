'use strict'

const fs = require('fs-extra')
const path = require('path')
const git = require('../git-kit')
const normalizePathSep = require('../noarmalize-path-sep')
const repoSerialization = require('../repo-serilization')

function loadGitRemoteNamesFromConfigFile (configFilePath) {
  return fs.readFile(configFilePath)
    .then(content => {
      return loadGitRemoteNamesFromConfigContent(content)
    })

  function loadGitRemoteNamesFromConfigContent (content) {
    const remoteMatcher = /\[remote\s\"([\w\d]+)\"\]/g
    let matches
    const remotes = []

    while ((matches = remoteMatcher.exec(content)) !== null) {
      remotes.push(matches[1])
    }

    return remotes
  }
}

/**
 * @typedef {Object} LocalCacheInfo
 * @property {String} cachingPath
 * @property {Array<repoSerialization.SerializedIndexEntry>} serializedIndexEntries
 */

/**
 * @class
 */
exports = module.exports = class RepoStorage {
  /**
     *
     * @param {String} storePath
     * @returns {Promise<void>}
     */
  setStorePath (storePath) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} sourcePath
     * @param {Boolean} isSaveTemplate
     * @returns {Promise<void>}
     */
  saveLocal (revisionName, sourcePath, isSaveTemplate) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} sourcePath
     * @returns {Promise<void>}
     */
  saveRemote (revisionName, sourcePath) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} destinationPath
     * @param {Boolean} isTEmplate
     * @returns {Promise<void>}
     */
  loadLocal (revisionName, destinationPath, isTemplate) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @param {String} destinationPath
     * @returns {Promise<void>}
     */
  loadRemote (revisionName, destinationPath) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @returns {Promise<CacheInfo>} returns cachingPath and indexFilePath
     */
  loadLocalToCache (revisionName) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {String} revisionName
     * @returns {Promise<string>} returns cachingPath
     */
  loadRemoteToCache (revisionName) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
     *
     * @param {string} revisionName
     * @returns {Promise<boolean>} returns if the storage contains revisionName
     */
  contains (revisionName) {
    return Promise.reject(new Error('Not implemented'))
  }

  serializeIndex (sourcePath, indexFilePath) {
    return git.Repository.open(sourcePath)
      .then((repoResult) => {
        return repoResult.refreshIndex()
      })
      .then((indexResult) => {
        return repoSerialization.seriailzeIndex(indexResult)
      })
      .then((dataString) => {
        return fs.writeFile(
          indexFilePath,
          dataString
        )
      })
  }

  deserializeIndex (indexFilePath) {
    return fs.readFile(indexFilePath)
      .then((dataString) => {
        return repoSerialization.deserializedIndex(dataString)
      })
  }

  serializeRemoteSetting (repoPath, remoteSettingPath) {
    return fs.exists(path.join(repoPath, '.git'))
      .then(isGitRepo => {
        if (isGitRepo) {
          return tryExtractRemotePaths(repoPath)
        } else {
          return {}
        }
      })
      .then(remotePaths => {
        return fs.writeJson(
          remoteSettingPath,
          remotePaths
        )
      })

    function tryExtractRemotePaths (repoPath) {
      const configPath = path.join(repoPath, '.git', 'config')
      return loadGitRemoteNamesFromConfigFile(configPath)
        .then(remoteNames => {
          return git.Config.openOndisk(configPath)
            .then(config => {
              let extractRemotePathPromise = Promise.resolve()

              const remotePathMapping = {}

              remoteNames.forEach(remoteName => {
                extractRemotePathPromise =
                            extractRemotePathPromise.then(() => {
                              return extractRemotePathToRelative(config, remoteName)
                            })
                              .then(remotePath => {
                                remotePathMapping[remoteNames] = remotePath
                              })
              })

              return extractRemotePathPromise
                .then(() => {
                  return remotePathMapping
                })
            })
        })

      function extractRemotePathToRelative (config, remoteName) {
        return config.getPath(`remote.${remoteName}.url`)
          .then(remotePath => {
            if (path.isAbsolute(remotePath)) {
              return path.relative(repoPath, remotePath)
            } else {
              return remotePath
            }
          })
          .then(remotePath => {
            return normalizePathSep.posix(remotePath)
          })
      }
    }
  }

  deserializeRemoteSetting (repoPath, remoteSettingPath, isRebaseRemotePath = true) {
    return fs.exists(path.join(repoPath), '.git')
      .then(isGitRepo => {
        if (isGitRepo) {
          return loadRemoteConfigFromSettingPath()
        } else {
          return Promise.resolve()
        }
      })

    function loadRemoteConfigFromSettingPath () {
      return fs.readJson(remoteSettingPath)
        .then(remotePathMapping => {
          const configFilePath = path.join(repoPath, '.git', 'config')
          return git.Config.openOndisk(configFilePath)
            .then(config => {
              return overwriteRepoRemoteSettings(
                config,
                configFilePath,
                repoPath,
                remotePathMapping
              )
            })
        })

      function overwriteRepoRemoteSettings (config, configFilePath, repoPath, remotePathMapping) {
        return loadGitRemoteNamesFromConfigFile(configFilePath)
          .then(remoteNames => {
            let overwriteRemoteSettingPromise = Promise.resolve()

            remoteNames.forEach(remoteName => {
              overwriteRemoteSettingPromise =
                            overwriteRemoteSettingPromise
                              .then(() => {
                                return tryOverwriteRemoteSetting(
                                  config,
                                  remoteName,
                                  repoPath,
                                  remotePathMapping
                                )
                              })
            })

            return overwriteRemoteSettingPromise
          })

        function tryOverwriteRemoteSetting (config, remoteName, repoPath, remotePathMapping) {
          if (remoteName in remotePathMapping) {
            const remotePath = isRebaseRemotePath ? path.join(repoPath, remotePathMapping[remoteName]) : remotePathMapping[remoteName]
            return config.setString(`remote.${remoteName}.url`, remotePath)
          } else {
            return Promise.resolve()
          }
        }
      }
    }
  }

  removeRemotePathsFromConfig (configFilePath) {
    return loadGitRemoteNamesFromConfigFile(configFilePath)
      .then(remotes => {
        return git.Config.openOndisk(configFilePath)
          .then(config => {
            let setRemotes = Promise.resolve()

            remotes.forEach(remote => {
              setRemotes = setRemotes.then(() => {
                return config.setString(`remote.${remote}.url`, '')
              })
            })

            return setRemotes
          })
      })
  }
}
