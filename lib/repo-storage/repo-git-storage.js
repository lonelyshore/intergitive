'use strict';

const fs = require('fs-extra');

const RepoStorage = require('./repo-storage');
const git = require('../git-kit');


const gitRepoFolderName = ".git";
const gitConfigFileSubPath = path.join('.git', 'config');
const wrapperFolderName = 'wrapper';
const repoFolderName = '_git_';
const indexFileName = 'index_serialization';

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
                    _copy(
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

exports = module.exports = class GitStorage extends RepoStorage {

    constructor(isAutoCrlf) {
        this.storePath = '';
        this.isAutoCrlf = isAutoCrlf;
        this[repo] = null;
    }

    setStorePath(storePath) {

        this.storePath = storePath;
        
        let init = () => {
            this.backupWorkTreePath = path.join(this.storePath, wrapperFolderName);
            this.backupRepoPath = path.join(this.storePath, wrapperFolderName, repoFolderName);
            this.referenceGitRepoPath = path.join(this.storePath, wrapperFolderName, gitRepoFolderName);
            this.indexFilePath = path.join(this.storePath, wrapperFolderName, indexFileName);
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

        return init()
        .then(() => {
            return prepareRepository()
        })
        .then(() => {
            return git.Repository.open(this.storePath)
            .then(result => {
                this[repo] = result;
            })
        })
        .then(() => {
            let configPath = path.join(this.storePath, gitConfigFileSubPath);
            return fs.exists(configPath)
            .then(exists => {
                if (!exists) {
                    return fs.createFile(configPath);
                }
                else{
                    return Promise.resolve();
                }
            })
            .then(() => {
                return git.Config.openOndisk(configPath);
            })
            .then(config => {
                return config.setString('core.autocrlf', this.isAutoCrlf ? 'true' : 'input');
            })
        })
    }

    save(revisionName, sourcePath, isSaveTemplate) {
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


        let repo = this[repo];

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
            );
        };

        let serializeIndex = () => {
            if (isSaveTemplate) {
                return git.Repository.open(sourcePath)
                .then((repoResult) => {
                    return repoResult.refreshIndex();
                })
                .then((indexResult) => {
                    return serialization.seriailzeIndex(indexResult);
                })
                .then((dataString) => {
                    return fs.writeFile(
                        this.indexFilePath,
                        dataString
                    );
                });
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

        let repo = this[repo];

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
                            return repo.createCommit("HEAD", _signature(), _signature(), tagName, indexTreeOid, parents);
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
};