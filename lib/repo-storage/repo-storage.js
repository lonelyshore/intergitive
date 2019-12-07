'use strict';

const fs = require('fs-extra');
const path = require('path');
const git = require('../git-kit');
const repoSerialization = require('../repo-serilization');

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
    setStorePath(storePath) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} sourcePath 
     * @param {Boolean} isSaveTemplate
     * @returns {Promise<void>}
     */
    saveLocal(revisionName, sourcePath, isSaveTemplate) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} sourcePath 
     * @returns {Promise<void>}
     */
    saveRemote(revisionName, sourcePath) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} destinationPath 
     * @param {Boolean} isTEmplate
     * @returns {Promise<void>}
     */
    loadLocal(revisionName, destinationPath, isTemplate) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} destinationPath 
     * @returns {Promise<void>}
     */
    loadRemote(revisionName, destinationPath) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName
     * @returns {Promise<CacheInfo>} returns cachingPath and indexFilePath
     */
    loadLocalToCache(revisionName) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName
     * @returns {Promise<string>} returns cachingPath
     */
    loadRemoteToCache(revisionName) {
        return Promise.reject(new Error('Not implemented'));
    }

    serializeIndex(sourcePath, indexFilePath) {
        return git.Repository.open(sourcePath)
        .then((repoResult) => {
            return repoResult.refreshIndex();
        })
        .then((indexResult) => {
            return repoSerialization.seriailzeIndex(indexResult);
        })
        .then((dataString) => {
            return fs.writeFile(
                indexFilePath,
                dataString
            );
        });
    }

    deserializeIndex(indexFilePath) {
        return fs.readFile(indexFilePath)
        .then((dataString) => {
            return repoSerialization.deserializedIndex(dataString);
        });
    }

    serializeRemoteSetting(repoPath, remoteSettingPath) {
        return fs.exists(path.join(repoPath, '.git'))
        .then(isGitRepo => {
            if (isGitRepo) {
                return tryExtractRemotePaths();
            }
            else {
                return {};
            }
        })
        .then(remotePaths => {
            return fs.writeJson(
                remoteSettingPath,
                remotePaths
            );
        });

        function tryExtractRemotePaths() {
            return git.Repository.open(repoPath)
            .then(repo => {
                return git.Remote.list(repo)
                .then(remoteNames => {
                    
                    let extractRemotePathPromise = Promise.resolve();

                    let remotePathMapping = {};

                    remoteNames.forEach(remoteName => {
                        extractRemotePathPromise =
                            extractRemotePathPromise.then(() => {
                                return extractRemotePathToRelative(repo, remoteName);
                            })
                            .then(remotePath => {
                                remotePathMapping[remoteNames] = remotePath;
                            });
                    });

                    return extractRemotePathPromise
                    .then(() => {
                        return repo.cleanup();
                    })
                    .then(() => {
                        return remotePathMapping;
                    });
                })
            });

            function extractRemotePathToRelative(repo, remoteName) {
                return git.Remote.lookup(repo, remoteName)
                .then(remote => {
                    let remotePath = remote.url();
                    if (path.isAbsolute(remotePath)) {
                        return path.relative(repoPath, remotePath);
                    }
                    else {
                        return remotePath;
                    }
                });
            }
        }
    }

    deserializeRemoteSetting(repoPath, remoteSettingPath) {
        return fs.exists(path.join(repoPath), '.git')
        .then(isGitRepo => {
            if (isGitRepo) {
                return loadRemoteConfigFromSettingPath();
            }
            else {
                return Promise.resolve();
            }
        });

        function loadRemoteConfigFromSettingPath() {
            return fs.readJson(remoteSettingPath)
            .then(remotePathMapping => {
                return git.Repository.open(repoPath)
                .then(repo => {
                    return overwriteRepoRemoteSettings(
                        repo,
                        repoPath,
                        remotePathMapping
                    );
                });
            });

            function overwriteRepoRemoteSettings(repo, remotePathMapping) {
                return git.Remote.list(repo)
                .then(remoteNames => {
                    let overwriteRemoteSettingPromise = Promise.resolve();

                    remoteNames.forEach(remoteName => {
                        overwriteRemoteSettingPromise =
                            overwriteRemoteSettingPromise
                            .then(() => {
                                return tryOverwriteRemoteSetting(
                                    remoteName
                                );
                            });
                    });

                    return overwriteRemoteSettingPromise;
                })
                .then(() => {
                    return repo.cleanup();
                });

                function tryOverwriteRemoteSetting(remoteName) {
                    if (remoteName in remotePathMapping) {
                        let remotePath = path.join(repoPath, remotePathMapping[remoteName]);
                        return git.Remote.setUrl(repo, remoteName, remotePath);
                    }
                    else {
                        return Promise.resolve();
                    }
                }
            }
        }
    }
}