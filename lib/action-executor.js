"use strict";

const fs = require("fs-extra");
const path = require("path");
const git = require("./git-kit");
const vcs = require('./repo-vcs');
const wait = require('./utility').wait;
const AssetLoader = require("./asset-loader").AssetLoader;
const RepoVcsSetup = require("./config-level").RepoVcsSetup;
const REPO_TYPE = require('./config-level').REPO_TYPE;

const operateRepo = Symbol("operateRepo");

class ActionExecutor {
    /**
     * 
     * @param {string} fileSystemBaseFolder 
     * @param {string} repoStoreSubPath
     * @param {AssetLoader} assetLoader
     * @param {Object} repoSetups
     * @param {vcs.STORAGE_TYPE} repoStorageType
     */
    constructor(fileSystemBaseFolder, repoStoreSubPath, assetLoader, repoSetups, repoStorageType) {
        this.fileSystemBaseFolder = fileSystemBaseFolder;
        this.assetLoader = assetLoader;
        this.repoSetups = Object.assign({}, repoSetups);
        this.repoStoreSubPath = repoStoreSubPath;
        this.repoStorageType = repoStorageType || vcs.STORAGE_TYPE.ARCHIVE;
    }

    /**
     * 
     * @param {Array<string>} sourceKeyIds 
     * @param {Array<string>} destinationPaths 
     */
    executeWriteFile(sourceKeyIds, destinationPaths) {
        
        if (sourceKeyIds.length !== destinationPaths.length) {
            return new Promise.reject(
                new Error(
                    `sourceKeyIds should have a length (${sourceKeyIds.length}) equals to the one of destinationPaths (${destinationPaths.length})`));
        }

        let writes = [];
        
        sourceKeyIds.forEach((keyId, index) => {
            writes.push(
                this.assetLoader.getFullAssetPath(keyId)
                .then(sourcePath => {
                    return fs.copy(sourcePath, path.join(this.fileSystemBaseFolder, destinationPaths[index]));
                })
            );
        });

        return Promise.all(writes).catch(err => {
            console.error("[executeWriteFile] " + err.message);
            throw err;
        });
    }

    executeRemoveFile(targetPaths) {
        let removes = [];
        let errors = [];
        
        targetPaths.forEach(targetPath => {
            let fullPath = path.join(this.fileSystemBaseFolder, targetPath);

            removes.push(
                fs.access(fullPath)
                .then(() => {
                    return fs.remove(path.join(this.fileSystemBaseFolder, targetPath));
                })
                .catch(err => {
                    errors.push(err);
                })
            );
        });

        return Promise.all(removes).then(() => {
            if (errors.length !== 0)
            {
                console.error("[executeRemoveFile] " + errors[0].message);
                throw errors[0];
            }
        });
    }

    executeMoveFile(sourcePath, destinationPath) {
        return fs.move(
            path.join(this.fileSystemBaseFolder, sourcePath), 
            path.join(this.fileSystemBaseFolder, destinationPath)
        )
        .catch(err => {
            console.error("[executeMoveFile] " + err.message);
            throw err;
        })
    }

    executeStaging(repoSetupName, pathspecs) {
        return this[operateRepo](
            repoSetupName,
            repo => {
                return repo.refreshIndex()
                .then(index => {
                    return index.addAll(pathspecs)
                    .then(() => {
                        return index.write();
                    });
                })
                .then(() => {
                    return repo.refreshIndex();
                })
                .catch(err => {
                    console.error("[executeStaging] " + err.message);
                    throw err;
                });
            }
        );
    }

    executeSetRemote(localSetupName, remoteSetupName, remoteNickName) {

        return this[operateRepo](
            localSetupName,
            repo => {
                let remoteSetup = this.repoSetups[remoteSetupName];
                if (!remoteSetup) {
                    return Promise.reject(`Failed to find remote setup ${remoteSetupName}`);
                }

                let remotePath = path.join(
                    this.fileSystemBaseFolder,
                    remoteSetup.workingPath
                );

                return repo.getRemotes()
                .then(remotes => {
                    if (remotes.indexOf(remoteNickName) === -1) {
                        return git.Remote.create(
                            repo,
                            remoteNickName,
                            remotePath
                        );
                    }
                    else {
                        git.Remote.setUrl(
                            repo,
                            remoteNickName,
                            remotePath
                        );
                    }
                })
                .catch(err => {
                    console.error(`[executeSetRemote] has error with localSetupName ${localSetupName}, remoteSetupName ${remoteSetupName}, remoteNickName ${remoteNickName}`);
                    return Promise.reject(err);
                });
            }
        );
    }

    executePushRemote(localSetupName, remoteNickName, refSpecs) {
        return this[operateRepo](
            localSetupName,
            repo => {
                return repo.getRemote(remoteNickName)
                .then(remote => {
                    return remote.push(refSpecs);
                })
                .catch(err => {
                    console.error(`[executePushRemote] has error with localSetupName ${localSetupName}, remoteNickName ${remoteNickName}, refSpecs ${refSpecs}`);
                    return Promise.reject(err);
                })
            }
        );
    }

    executeLoadReference(repoSetupName, referenceName) {
        return this.operateReferenceManager(
            repoSetupName, 
            (referenceManager) => {
                return referenceManager.restore(referenceName);
            }
        );
    }

    executeSaveCheckpoint(repoSetupName, checkpointName) {
        return this.operateCheckpointManager(
            repoSetupName,
            (checkpointManager) => {
                return checkpointManager.backup(checkpointName);
            }
        );
    }

    executeLoadCheckpoint(repoSetupName, checkpointName) {
        return this.operateCheckpointManager(
            repoSetupName,
            (checkpointManager) => {
                return checkpointManager.restore(checkpointName);
            }
        );
    }

    executeCompareReference(repoSetupName, referenceName) {
        return this.operateReferenceManager(
            repoSetupName,
            (referenceManager) => {
                return referenceManager.equivalent(referenceName);
            }
        )
    }

    [operateRepo](repoSetupName, operation) {
        let getRepo = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!("repo" in setup)) {
                    return git.Repository.open(path.join(this.fileSystemBaseFolder, setup.workingPath))
                    .then(repo => {
                        setup.repo = repo;
                        return repo;
                    });
                }
                else {
                    return Promise.resolve(setup.repo);
                }
            }
        };

        return wait(10)
        .then(() => {
            return getRepo();
        })
        .then(repo => {
            return operation(repo)
            .then(results => {
                repo.cleanup();
                return results;
            })
            .catch(err => {
                console.error(err);
                return Promise.reject(err);
            });
        });
    }

    operateReferenceManager(repoSetupName, operation) {
        let getReferenceManager = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!('referenceManager' in setup)) {
                    return vcs.RepoReferenceManager.create(
                        path.join(this.fileSystemBaseFolder, setup.workingPath),
                        path.join(this.fileSystemBaseFolder, this.repoStoreSubPath),
                        setup.referenceStoreName,
                        setup.remoteType === REPO_TYPE.REMOTE,
                        this.repoStorageType
                    )
                    .then(result => {
                        setup.referenceManager = result;
                        return result;
                    });
                }
                else {
                    return Promise.resolve(setup.referenceManager)
                }
            }
        }

        return getReferenceManager()
        .then(referenceManager => {
            return operation(referenceManager);
        });
    }

    operateCheckpointManager(repoSetupName, operation) {
        let getManager = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!('checkpointManager' in setup)) {
                    return vcs.RepoCheckpointManager.create(
                        path.join(this.fileSystemBaseFolder, setup.workingPath),
                        path.join(this.fileSystemBaseFolder, this.repoStoreSubPath),
                        setup.checkpointStoreName,
                        setup.remoteType === REPO_TYPE.REMOTE,
                        this.repoStorageType
                    )
                    .then(result => {
                        setup.checkpointManager = result;
                        return result;
                    })
                }
                else {
                    return Promise.resolve(setup.checkpointManager);
                }
            }
        }

        return getManager()
        .then(checkpointManager => {
            return operation(checkpointManager);
        });
    }
}

module.exports.ActionExecutor = ActionExecutor;