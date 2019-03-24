
"use strict";

const fs = require("fs-extra");
const git = require("./git-kit");
const path = require('path');
const assert = require('assert');

function _signature() {
    return git.Signature.now("backup", "backup@serv.ice");
}

/**
 * Copy the file or the whole folder from source path to a rebased destination path
 * @param {string} sourcePath  The path to the file or folder that will be copied
 * @param {string} sourceBasePath The base path of the source that will be replaced by destinationBasePath
 * @param {string} destinationBasePath The base path of the destination
 */
function _copy(sourcePath, sourceBasePath, destinationBasePath) {
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

const _repo = Symbol('_repo');

exports.RepoVersionControl = class RepoVersionControl {

    static get wrapperFolderName() { return "wrapper"; }
    static get repoFolderName() { return "_git_"; }
    static get workTreeFolderName() { return "work_tree"; }

    /**
     * Used to backup and restore git repositories
     * @param {string} storesPath Base path to repository stores
     */
    constructor(storesPath) {
        this.storesPath = storesPath;

        fs.ensureDirSync(this.storesPath);
    }

    /**
     * 
     * @param {string} sourcePath Path to the git repository that will be backuped from or restored to
     * @param {string} storeName Name to the backup store
     */
    setTarget(sourcePath, storeName) {

        assert(fs.existsSync(sourcePath));
        assert(fs.existsSync(this.storesPath));

        this.sourcePath = sourcePath;
        this.storePath = path.join(this.storesPath, storeName);
        this.backupWorkTreePath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, RepoVersionControl.workTreeFolderName);
        this.backupRepoPath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, RepoVersionControl.repoFolderName);

        let prepareRepository = () => Promise.resolve();

        if (!fs.existsSync(this.storePath)) {

            prepareRepository = () => {
                 fs.mkdirp(this.storePath)
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

        return prepareRepository()
        .then(() => {
            return git.Repository.open(this.storePath);
        })
        .then((repo) => {
            this[_repo] = repo;
        });
    }

    /**
     * 
     * @param {string} tagName Code name for the backup, used to restore later
     */
    backup(tagName) {
        
        assert(fs.existsSync(this.sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));

        let copyWorkTree = () =>{

            return fs.emptyDir(this.backupWorkTreePath)
            .then(() => {
                return fs.readdir(this.sourcePath);
            })
            .then((sourceRepoSubPaths) => {
                let copies = Promise.resolve();

                sourceRepoSubPaths.forEach((sourceSubPath) => {

                    if (sourceSubPath !== '.git') {
                        copies = copies.then(
                            () => _copy(
                                path.join(this.sourcePath, sourceSubPath), this.sourcePath, this.backupWorkTreePath));
                    }

                })

                return copies;
            });
        };

        let clearRepo = () => {
            return fs.readdir(this.backupRepoPath)
            .then((backupRepoSubPaths) => {
                let removes = Promise.resolve();

                backupRepoSubPaths.forEach((backupRepoSubPath) => {
                    if (backupRepoSubPath !== "objects") {
                        removes = removes.then(
                            () => fs.remove(path.join(this.backupRepoPath, backupRepoSubPath)));
                    }
                })

                return removes;
            });
        };

        let copyRepo = () => {

            let sourceRepoPath = path.join(this.sourcePath, ".git");
            return fs.readdir(sourceRepoPath)
            .then((sourceRepoSubPaths) => {
                let copies = Promise.resolve();
                sourceRepoSubPaths.forEach((sourceRepoSubPath) => {
                    if (sourceRepoSubPath !== "objects") {
                        copies = copies.then(
                            () => _copy(
                                path.join(sourceRepoPath, sourceRepoSubPath), 
                                sourceRepoPath, 
                                this.backupRepoPath));
                    }
                })

                return copies;
            });
        };

        let copyRepoObjects = () => {
            return fs.copy(
            path.join(this.sourcePath, ".git", "objects"),
            path.join(this.backupRepoPath, "objects"), 
            {
                overwrite: false,
                errorOnExit: false,
            });
        };

        let repo = this[_repo];
        
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
                if (repo.isEmpty() && index.entryCount() != 0) {
                    return index.writeTree()
                    .then((indexTreeOid) => {
                        return repo.createCommit("HEAD", _signature(), _signature(), tagName, indexTreeOid, []);
                    });
                }
                else {

                    let baseCommit;
                    let branchRef;

                    return repo.getReference("master")
                    .then((ref) => branchRef = ref)
                    .then(() => repo.getReferenceCommit(branchRef))
                    .then((baseCommitResult) => {
                        baseCommit = baseCommitResult;
                    })
                    .then(() => {
                        return baseCommit.getTree();
                    })
                    .then((baseTree) => {
                        return git.Diff.treeToIndex(repo, baseTree, null);
                    })
                    .then((diff) => {
                        if (diff.numDeltas() !== 0) {
                            return index.writeTree()
                            .then((indexTreeOid) => {
                                return repo.createCommit(branchRef.name, _signature(), _signature(), tagName, indexTreeOid, [baseCommit]);
                            })
                            .then((commitOid) => {
                                return {
                                    commitCreated: true,
                                    commitOid: commitOid
                                };
                            });
                        }
                        else {
                            console.log("Nothing changed, not commiting for tag " + tagName);
                            return {
                                commitCreated: false,
                                commitOid: baseCommit.id()
                            };
                        }
                    })
                }
            });
        };

        let stageAndCommitAndTag = () => {

            return tryStage()
            .then(tryCommitAndGetResult)
            .then((commitResult) => {

                if (commitResult.commitCreated) {
                    let commitOid = commitResult.commitOid;

                    return git.helpers.Tag.hasTag(repo)
                    .then((hasTag) => {
                        if (hasTag) {
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

            });
        };

        let isBreaking = false;
        return copyWorkTree()
        .catch((err) => {
            console.error("Error happend when trying to copy work tree for " + this.sourcePath);
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
                console.error("Error happened when trying to copy repo from " + this.sourcePath + " to " + this.backupRepoPath);
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(copyRepoObjects)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to copy repo objects from " + this.sourcePath + "to" + this.backupRepoPath);
                isBreaking = true;
            }

            return Promise.reject(err);
        })
        .then(stageAndCommitAndTag)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to create commit");                
                isBreaking = true;
            }
            
            return Promise.reject(err);
        });
    }
}
