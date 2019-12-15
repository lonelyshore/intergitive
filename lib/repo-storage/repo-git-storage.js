'use strict';

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');

const RepoStorage = require('./repo-storage');
const git = require('../git-kit');

const gitRepoFolderName = ".git";
const gitConfigFileSubPath = path.join('.git', 'config');
const wrapperFolderName = 'wrapper';
const repoFolderName = '_git_';
const indexFileName = 'index_serialization';
const remoteSettingFileName = 'remote_setting';

const _ensurePreserveMode = Symbol('_ensurePreserveMode');
const _copyToBackup = Symbol('_copyToBackup');
const _commitBackup = Symbol('_commitBackup');
const _copyToTarget = Symbol('_copyToTarget');

function signature() {
    return git.Signature.now("backup", "backup@serv.ice");
}

/**
 * Copy the file or the whole folder from source path to a rebased destination path
 * @param {string} sourcePath  The path to the file or folder that will be copied
 * @param {string} sourceBasePath The base path of the source that will be replaced by destinationBasePath
 * @param {string} destinationBasePath The base path of the destination
 */
function copyFileOrFolder(sourcePath, sourceBasePath, destinationBasePath) {
    return fs.stat(sourcePath)
    .then((stat) => {
        if (stat.isDirectory()) {
            let targetPath = path.join(destinationBasePath, sourcePath.replace(sourceBasePath, ""));
            return fs.mkdir(targetPath)
            .then(() =>{
                return fs.copy(sourcePath, targetPath, { preserveTimestamps: true });
            });
        }
        else {
            return fs.copy(
                sourcePath, 
                path.join(destinationBasePath, sourcePath.replace(sourceBasePath, "")), 
                { preserveTimestamps: true });
        }
    });
}

/**
 * Return true if the passed subPath should be copied
 * 
 * @callback filterCallback
 * @param {string} parentPath
 * @param {string} subPath
 * @returns {boolean}
 */

/**
 * 
 * @param {string} sourcePath 
 * @param {string} destinationPath 
 * @param {filterCallback} filterCallback 
 */
function filterChildrenAndCopy(sourcePath, destinationPath, filterCallback) {

    return fs.readdir(sourcePath)
    .then((sourceSubPaths) => {
        let copies = []

        sourceSubPaths.forEach((sourceSubPath) => {

            if (filterCallback(sourcePath, sourceSubPath)) {
                copies.push(
                    copyFileOrFolder(
                        path.join(sourcePath, sourceSubPath), 
                        sourcePath, 
                        destinationPath));
            }

        })

        return Promise.all(copies);
    });
}

/**
 * 
 * @param {string} targetPath 
 * @param {filterCallback} filterCallback 
 */
function filterChildrenAndRemove(targetPath, filterCallback) {

    return fs.readdir(targetPath)
    .then((targetSubPaths) => {
        let removes = [];

        targetSubPaths.forEach((targetSubPath) => {
            if (filterCallback(targetPath, targetSubPath)) {
                removes.push(
                    fs.remove(path.join(targetPath, targetSubPath)));
            }
        })

        return Promise.all(removes);
    });
}

/**
 * @inheritdoc
 */
exports = module.exports = class GitStorage extends RepoStorage {

    constructor(isAutoCrlf) {
        super();

        this.storePath = '';
        this.isAutoCrlf = isAutoCrlf;
        this.repo = null;
    }

    setStorePath(storePath) {

        this.storePath = storePath;
        
        let init = () => {
            this.backupWorkTreePath = 
                path.join(
                    this.storePath, wrapperFolderName
                );
            this.backupRepoPath = 
                path.join(
                    this.storePath, wrapperFolderName, repoFolderName
                );
            this.referenceGitRepoPath = 
                path.join(
                    this.storePath, wrapperFolderName, gitRepoFolderName
                );
            this.indexFilePath = 
                path.join(
                    this.storePath, wrapperFolderName, indexFileName
                );
            this.remoteSettingPath =
                path.join(
                    this.storePath, wrapperFolderName, remoteSettingFileName
                );
        }

        let prepareRepository = () => Promise.resolve();

        if (!fs.existsSync(this.storePath)) {

            prepareRepository = () => {
                return fs.mkdirp(this.storePath)
                .then(() => { 
                    return git.Repository.init(this.storePath, 0);
                })
                .then(() => {
                    return fs.mkdirp(this.backupRepoPath);
                })
                .then(() => {
                    return fs.mkdirp(this.backupWorkTreePath);
                });
            };
        }

        return Promise.resolve()
        .then(() => {
            init();
        })
        .then(() => {
            return prepareRepository()
        })
        .then(() => {
            return git.Repository.open(this.storePath)
            .then(result => {
                this.repo = result;
            })
        })
        .then(() => {
            let configPath = path.join(this.storePath, gitConfigFileSubPath);
            return fs.access(configPath)
            .then(() => {}, () => fs.createFile(configPath))
            .then(() => {
                return git.Config.openOndisk(configPath);
            })
            .then(config => {
                return config.setString('core.autocrlf', this.isAutoCrlf ? 'true' : 'input');
            });
        })
    }

    saveLocal(revisionName, sourcePath, isSaveTemplate) {
        let asserts = () => {
            return Promise.resolve()
            .then(() => {
                assert(
                    fs.existsSync(sourcePath), 
                    `sourcePath ${sourcePath} does not exist`
                );
                assert(
                    fs.existsSync(this.storePath), 
                    `storePath ${this.storePath} does not exist`
                );
                assert(
                    fs.existsSync(path.join(this.storePath, gitRepoFolderName)), 
                    `storePath does not has .git folder`
                );
            });
        };


        let repo = this.repo;

        let ensureOnMaster = () => {
            if (!repo.isEmpty()) {
                return this[_ensurePreserveMode]()
                .then(() => {
                    return git.Commands.cleanCheckoutRef(repo, "master");
                });
            }
            else {
                return Promise.resolve();
            }
        }

        let isBreaking = false;
        return asserts()
        .catch(err => {
            if (!isBreaking) {
                console.error("Assertion failed: " + err);
            }
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(() => {
            return ensureOnMaster();
        })
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to checkout master branch");
            }
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(() => {
            return this[_copyToBackup](sourcePath, isSaveTemplate);
        })
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to copy from source folder");                
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(() => {
            return this[_commitBackup](revisionName);
        })
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when commiting");
                console.error(err);
                isBreaking = true;
            }

            throw err;
        });
    }

    loadLocal(revisionName, destinationPath, isTemplate) {

        let assertPaths = () => {
            return Promise.resolve()
            .then(() => {
                assert(fs.existsSync(this.storePath), `storePath ${this.storePath} does not exist`);
                assert(fs.existsSync(path.join(this.storePath, '.git')), `expect storePath to have .git folder, but it does not`);
            });
        };
        
        let repo = this.repo;

        assert(!repo.isEmpty(), "repo is empty");

        let checkoutTag = () => {
            return this[_ensurePreserveMode]()
            .then(() => {
                return git.Commands.cleanCheckoutRef(repo, revisionName);
            })
        };

        let isBreaking = false;
        return assertPaths()
        .catch(err => {
            console.error("[restore] Assertion failed: " + err);
            isBreaking = true;

            throw err;
        })
        .then(() => {
            return checkoutTag();
        })
        .catch((err) => {
            if (!isBreaking) {
                console.error(`Error occured when checkout tag <${revisionName}>`);
                console.error(err);
                isBreaking = true;
            }

            throw err;
        })
        .then(() => this[_copyToTarget](destinationPath, isTemplate)) 
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error occured when restoring " + destinationPath);
                console.error(err);
                isBreaking = true;
            }

            throw err;
        });
        
    }

    loadLocalToCache(revisionName) {

        let assert = () => {
            assert(fs.existsSync(this.storePath));
            assert(fs.existsSync(path.join(this.storePath, gitRepoFolderName)));
        }

        let checkoutTag = () => {

            return this[_ensurePreserveMode]()
            .then(() => {
                return git.Commands.cleanCheckoutRef(this.repo, revisionName);
            })
            .then(() => {
                return fs.rename(this.backupRepoPath, this.referenceGitRepoPath);
            });
        };

        let serializedIndexEntries;

        return Promise.resolve()
        .then(() => {
            return checkoutTag();
        })
        .then(() => {
            return super.deserializeIndex(this.indexFilePath)
            .then(result => {
                serializedIndexEntries = result;
            })
            .then(() => {
                return super.deserializeRemoteSetting(this.backupWorkTreePath, this.remoteSettingPath);
            })
        })
        .then(() => {
            return fs.remove(this.indexFilePath)
            .then(() => {
                return fs.remove(this.remoteSettingPath);
            });
        })
        .then(() => {
            return {
                cachingPath: this.backupWorkTreePath,
                serializedIndexEntries: serializedIndexEntries
            };
        });
    }

    [_ensurePreserveMode]() {

        return fs.exists(this.referenceGitRepoPath)
        .then(isReferenceGitRepoExists => {
            if (isReferenceGitRepoExists) {
                return fs.exists(this.backupRepoPath)
                .then(isBackupRepoExists => {
                    if (isBackupRepoExists) {
                        return fs.remove(this.referenceGitRepoPath);
                    }
                    else {
                        return fs.rename(this.referenceGitRepoPath, this.backupRepoPath);
                    }
                }) 
            }
            else {
                return Promise.resolve();
            }
        });
    }

    [_copyToBackup](sourcePath, isSaveTemplate) {
        let copyWorkTree = () => {

            return filterChildrenAndRemove(
                this.backupWorkTreePath,
                (targetParentPath, targetSubPath) => {
                    return targetSubPath !== "_git_";
                }
            )
            .then(() => {
                return filterChildrenAndCopy(
                    sourcePath,
                    this.backupWorkTreePath,
                    (sourceParentPath, sourceSubPath) => {
                        return sourceSubPath !== ".git";
                    }
                );
            });

        };

        let clearRepo = () => {
            return filterChildrenAndRemove(
                this.backupRepoPath,
                (targetParentPath, targetSubPath) => {
                    return targetSubPath !== "objects";
                })
        };

        let copyRepo = () => {

            let sourceRepoPath = path.join(sourcePath, ".git");
            return filterChildrenAndCopy(
                sourceRepoPath,
                this.backupRepoPath,
                (parentPath, subPath) => {
                    return subPath !== "objects";
                }
            )
            .then(() => {
                return tryHideRemoteUrl(this.backupRepoPath, super.removeRemotePathsFromConfig);
            });

            function tryHideRemoteUrl(targetRepoPath, hideRemoteUrl) {
                let configPath = path.join(targetRepoPath, 'config');
                return fs.exists(configPath)
                .then(() => {
                    return hideRemoteUrl(configPath);
                }, () => {});
            }
        };

        let serializeIndex = () => {
            if (isSaveTemplate) {
                return super.serializeIndex(sourcePath, this.indexFilePath);
            }
            else {
                return Promise.resolve();
            }
        }

        let copyRepoObjects = () => {
            return fs.copy(
            path.join(sourcePath, ".git", "objects"),
            path.join(this.backupRepoPath, "objects"), 
            {
                overwrite: false,
                errorOnExit: false,
            });
        };

        let isBreaking = false;
        return copyWorkTree()
        .catch((err) => {
            console.error("Error happend when trying to copy work tree for " + sourcePath);
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(clearRepo)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to clear repo backup at " + this.backupRepoPath);
                isBreaking = true;
            }

            return Promise.reject(err);
        })
        .then(copyRepo)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to copy repo from " + sourcePath + " to " + this.backupRepoPath);
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(serializeIndex)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to serialize index from " + sourcePath);
                isBreaking = true;
            }
            
            return Promise.reject(err);           
        })
        .then(() => {
            return super.serializeRemoteSetting(sourcePath, this.remoteSettingPath);
        })
        .catch(err => {
            if (!isBreaking) {
                console.error(`Error happened when trying to serialize remote setting for ${sourcePath}`);
                isBreaking = true;
            }

            return Promise.reject(err);
        })
        .then(copyRepoObjects)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to copy repo objects from " + sourcePath + "to" + this.backupRepoPath);
                isBreaking = true;
            }

            return Promise.reject(err);
        });
    }

    [_commitBackup](tagName) {

        let repo = this.repo;

        let tryStage = () => {
            return repo.refreshIndex()
            .then((index) => {
                return index.addAll()
                .then(() => index.write());
            });
        };

        let tryCommitAndGetResult = () => {

            let index;

            return repo.refreshIndex()
            .then((indexResult) => {
                index = indexResult;
                let getParentsPromise;

                if (repo.isEmpty() && index.entryCount() != 0) {
                    getParentsPromise = () => Promise.resolve([]);
                }
                else {
                    getParentsPromise = () => {
                        return repo.getReference("HEAD")
                        .then((ref) => repo.getReferenceCommit(ref))
                        .then((baseCommitResult) => {
                            return [baseCommitResult];
                        });
                    };
                }

                let parents;

                return getParentsPromise()
                .then((parentsResult) => {
                    parents = parentsResult;
                })
                .then(() => {

                    let checkShouldCommit;

                    if (parents.length === 0) {
                        checkShouldCommit = () => Promise.resolve(true);
                    }
                    else {
                        checkShouldCommit = () => {
                            return parents[0].getTree()
                            .then((baseTree) => {
                                return git.Diff.treeToIndex(repo, baseTree, null);
                            })
                            .then((diff) => {
                                return diff.numDeltas() !== 0;
                            });
                        }
                    }
                    
                    return checkShouldCommit();
                })
                .then((shouldCommit) => {
                    if (shouldCommit) {
                        return index.writeTree()
                        .then((indexTreeOid) => {
                            return repo.createCommit("HEAD", signature(), signature(), tagName, indexTreeOid, parents);
                        })
                        .then((commitOid) => {
                            return {
                                commitCreated: true,
                                commitOid: commitOid
                            };
                        });
                    }
                    else {
                        console.log("Nothing changed, not commiting for tag <" + tagName + ">");
                        return {
                            commitCreated: false,
                            commitOid: parents.length === 0 ? 0 : parents[0].id()
                        };
                    }
                })
            });
        };


        let isBreaking = false;

        return tryStage()
        .catch((err) => {
            console.error("Error occured when staging");
            console.error(err);
            isBreaking = true;
            throw err;
        })
        .then(tryCommitAndGetResult)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error occured when creating commit");
                console.error(err);
                isBreaking = true;
                throw err;
            }
        })
        .then((commitResult) => {

            if (commitResult.commitCreated) {
                let commitOid = commitResult.commitOid;

                return git.Tag.hasTag(repo, tagName)
                .then((hasTag) => {
                    if (!hasTag) {
                        return repo.createLightweightTag(commitOid, tagName);
                    }
                    else {
                        console.log(tagName + " already exists, update its position to " + commitOid);
                        return git.Tag.delete(repo, tagName)
                        .then(() => {
                            return repo.createLightweightTag(commitOid, tagName);
                        })
                    }
                });
            }

        })
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error occured when updating tag " + tagName);
                console.error(err);
                isBreaking = true;
                throw err;
            }
        });
    }

    
    [_copyToTarget](destinationPath, isTemplate) {

        let copyWorkTree = () => {

            return fs.emptyDir(destinationPath)
            .then(() => {
                return filterChildrenAndCopy(
                    this.backupWorkTreePath,
                    destinationPath,
                    (parentPath, subPath) => {
                        if (parentPath === this.backupWorkTreePath) {
                            return subPath !== "_git_" && subPath !== indexFileName;
                        }
                        else {
                            return true;
                        }
                    }
                );
            });

        };

        let copyRepo = () => {

            let destinationRepoPath = path.join(destinationPath, ".git");

            return fs.ensureDir(destinationRepoPath)
            .then(() => {
                return filterChildrenAndCopy(
                    this.backupRepoPath,
                    destinationRepoPath, 
                    (parentPath, subPath) => {
                        if (parentPath === this.backupRepoPath) {
                            return subPath !== "objects" // skip "objects" because their timestamps cannot be preserved (will trigger EPERM)
                        }
                        else {
                            return true;
                        }
                    }
                );
            })
            .then(() => {
                return fs.access(path.join(this.backupRepoPath, 'objects'))
                .then(() => {
                    return fs.copy(
                        path.join(this.backupRepoPath, "objects"),
                        path.join(destinationRepoPath, "objects")
                    )
                }, () => {})
                .then(() => {
                    return fs.ensureDir(path.join(destinationRepoPath, 'objects'))
                    .then(() => fs.ensureDir(path.join(destinationRepoPath, 'refs')));
                });
            });

        };

        let sourceRepo;
        let restoreIndex = () =>{
            if (false) {

                let serializedIndexEntries;
                let index;

                return this[_loadSerializedIndex]()
                .then((serializedIndexEntriesResult) => {
                    serializedIndexEntries = serializedIndexEntriesResult;
                    return git.Repository.open(destinationPath);
                })
                .then((repoResult) => {
                    sourceRepo = repoResult;
                    return sourceRepo.refreshIndex();
                })
                .then((indexResult) => {
                    index = indexResult;
                    return index.clear();
                })
                .then(() => {
                    serializedIndexEntries.forEach((entry) => {
                        index.add(entry.createIndexEntry());
                    });

                    return index.write();
                })
                .then(() => {
                    return sourceRepo.refreshIndex();
                });
            }
            else {
                return Promise.resolve();
            }
        }

        let isBreaking = false;
        return copyWorkTree()
        .catch((err) => {
            console.error("Error happend when trying to copy work tree for " + destinationPath);
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(copyRepo)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to restore repo to " + destinationPath + " from " + this.backupRepoPath);
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(restoreIndex)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to restore index for " + destinationPath + " from " + this.indexFilePath);
                isBreaking = true;
            }

            return Promise.reject(err);
        })
        .then(() => super.deserializeRemoteSetting(destinationPath, this.remoteSettingPath))
        .catch(err => {
            if (!isBreaking) {
                console.error(`Error hapened when trying to overwrite remote setting for ${destinationPath}`);
                isBreaking = true;
            }

            return Promise.reject(err);
        });
    }
};