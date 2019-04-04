
"use strict";

const fs = require("fs-extra");
const git = require("./git-kit");
const path = require('path');
const assert = require('assert');
const serialization = require('./repo-serilization');

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
function _filterChildrenAndCopy(sourcePath, destinationPath, filterCallback) {

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
function _filterChildrenAndRemove(targetPath, filterCallback) {

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

class CommitNode {

    /**
     * 
     * @param {git.Repository} repo
     * @param {git.Reference} reference 
     * @param {object} cache 
     * @returns {Promise<CommitNode>}
     */
    static buildFromReference(repo, reference, cache) {
        return repo.getReferenceCommit(reference)
        .then((commit) => {
            return buildFromCommit(commit, cache);
        });
    }

    /**
     * 
     * @param {git.Commit} commit 
     * @param {object} cache 
     * @returns {Promise<CommitNode>}
     */
    static buildFromCommit(commit, cache) {
        if (commit.sha() in cache) {
            return Promise.resolve(cache[commit.sha()]);
        }
        else {
            let newNode = new CommitNode([], commit.treeId().tostrS());
            cache[commit.sha()] = newNode; // occupy cache first to avoid race condition

            let parentCount = commit.parentCount();
            if (parentCount === 0) {
                newNode.previouses = null;
                return Promise.resolve(newNode);
            }
            else {
                let previouses = newNode.previouses;
                let getPreviouses = [];
                for (let i = 0; i < parentCount; i++) {
                    getPreviouses.push(
                        commit.parent(i)
                        .then((parentCommit) => {
                            return buildFromCommit(parentCommit, cache);
                        })
                        .then(parentNode => {
                            previouses.push(parentNode);
                        })
                    );
                }

                return Promise.all(getPreviouses)
                .then(() => {
                    return Promise.resolve(newNode);
                })
            }
        }
    }

    /**
     * 
     * @param {Array<CommitNode>} previouses
     * @param {string} treeId 
     */
    constructor(previouses, treeId) {
        this.previouses = previouses;
        this.treeId = treeId;
    }

    /**
     * 
     * @param {CommitNode} other 
     */
    equals(other) {
        return this.treeId === other.treeId && previousesEquas(other.previouses);
    }

    previousesEquas(otherPreviouses) {
        if (this.previouses === null && otherPreviouses === null) {
            return true;
        }
        else {
            if (this.previouses === null || otherPreviouses === null) {
                return false;
            }
            else if (this.previouses.length != otherPreviouses.length){
                return false;
            }
            else {
                for (let i = 0; i < this.previouses.length; i++) {
                    if (!this.previouses[i].equals(otherPreviouses[i])) {
                        return false;
                    }
                }

                return true;
            }
        }
    }
}

/**
 * 
 * @param {Array<CommitNode>} repoNodes
 * @param {Array<CommitNode>} refNodes
 * @returns {boolean}
 */
function _compareRepoNodes(repoNodes, refNodes) {
    
    for (let i = 0; i < repoNodes; i++) {
        if (!repoNodes[i].equals(refNodes[i])) {
            return false;
        }
    }
    
    return true;
}

function _countObjectNumber(repoPath) {

    let repoObjectPath = path.join(repoPath, "objects");

    let repoObjectCount = 0;
    return fs.readdir(repoObjectPath)
    .then((paths) => {
        let expands = [];
        paths.forEach((path) => {
            let fullPath = path.join(repoObjectPath, path);

            expands.push(
                Promise.resolve()
                .then(() => {
                    return fs.stat(fullPath);
                })
                .then(stat => {
                    if (stat.isDirectory()) {
                        return false.readdir(fullPath)
                        .then(subPaths => {
                            repoObjectCount += subPaths.length;
                        });
                    }
                    else {
                        repoObjectCount += 1;
                    }
                }));
        });

        return Promise.all(expands);
    })
    .then(() => {
        return repoObjectCount;
    })
}

function _compareRepoRevisionFiles(repoPath, refRepoPath) {
    let repoObjectCount = 0
    let refObjectCount = 0;

    return _countObjectNumber(repoPath)
    .then(count => {
        repoObjectCount = count;
        return _countObjectNumber(refRepoPath);
    })
    .then(count => {
        refObjectCount = count;
    })
    .then(() => {
        return repoObjectCount == refObjectCount;
    })
}

const _repo = Symbol('_repo');
const _copyToBackup = Symbol("_copyToBackup");
const _commitBackup = Symbol("_commitBackup");
const _copyToTarget = Symbol("_copyToTarget");
const _compareRepoRevisions = Symbol("_compareRepoRevisions");

const gitRepoFolderName = ".git";

exports.RepoVersionControl = class RepoVersionControl {

    static get wrapperFolderName() { return "wrapper"; }
    static get repoFolderName() { return "_git_"; }
    static get workTreeFolderName() { return "work_tree"; }
    static get indexFileName() { return "index_serialization"; }

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
        this.indexFilePath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, RepoVersionControl.repoFolderName, RepoVersionControl.indexFileName);

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
     * @param {boolean} isTemplate Is backup for template
     * @returns {Promise<void>}
     */
    backup(tagName, isTemplate) {
        
        assert(fs.existsSync(this.sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));

        let repo = this[_repo];

        let ensureOnMaster = () => {
            if (!repo.isEmpty()) {
                return git.Commands.cleanCheckoutRef(repo, "master");
            }
            else {
                return Promise.resolve();
            }
        }

        let isBreaking = false;
        return ensureOnMaster()
        .catch((err) => {
            console.error("Error happened when trying to checkout master branch");
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(() => this[_copyToBackup](isTemplate))
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to copy from source folder");                
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(() => this[_commitBackup](tagName))
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when commiting");
                console.error(err);
                isBreaking = true;
            }

            throw err;
        });
    }
    
    /**
     * 
     * @param {string} tagName 
     * @param {boolean} isTemplate Is restore from a template
     */
    restore(tagName, isTemplate) {

        assert(fs.existsSync(this.sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));
        
        let repo = this[_repo];

        assert(!repo.isEmpty());

        let checkoutTag = () => {
            return git.Commands.forceCheckoutRef(repo, tagName);
        };

        let isBreaking = false;
        return checkoutTag()
        .catch((err) => {
            console.error("Error occured when checkout tag <" + tagName + ">");
            console.error(err);
            isBreaking = true;

            throw err;
        })
        .then(() => this[_copyToTarget](isTemplate)) 
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error occured when restoring " + this.sourcePath);
                console.error(err);
                isBreaking = true;
            }

            throw err;
        });
    }

    diffWithTemplate(tagName) {

        assert(fs.existsSync(this.sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));
        
        let repo = this[_repo];

        assert(!repo.isEmpty());

        let referenceGitRepoPath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, gitRepoFolderName);

        let checkoutTag = () => {
            return fs.exists(referenceGitRepoPath)
            .then(() => {
                return fs.rename(referenceGitRepoPath, this.backupRepoPath);
            })
            .then(() => {
                return git.Commands.forceCheckoutRef(repo, tagName);
            })
            .then(() => {
                return fs.rename(this.backupRepoPath, referenceGitRepoPath);
            });
        };

        let referenceRepo;
        let loadReferenceRepo = () => {
            return git.Repository.open(referenceGitRepoPath)
            .then((repoResult) => {
                referenceRepo = repoResult;
            });
        };

        let sourceRepo;
        let loadSourceRepo = () => {
            return git.Repository.open(this.sourcePath)
            .then(repoResult => {
                sourceRepo = repoResult;
            });
        };

        let isBreaking = false;
        return checkoutTag()
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when checkout tag " + tagName + " for repo " + this.storePath);
                isBreaking = true;
            }

            throw err;
        })
        .then(() => _compareRepoRevisionFiles(
            path.join(this.sourcePath, gitRepoFolderName),
            referenceGitRepoPath
        ))
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing object files between " + this.sourcePath + " and " + this.backupRepoPath);
                isBreaking = true;
            }
            
            throw err;
        })
        .then(isObjectsSameCount => {
            if (!isObjectsSameCount) {
                return Promise.resolve(false);
            }
            else {
                return loadReferenceRepo()
                .then(loadSourceRepo)
                .then(() => this[_compareRepoRevisions(sourceRepo, referenceRepo)]);
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing repo revisions between " + this.sourcePath + " and " + this.backupRepoPath);
                isBreaking = true;
            }
            
            throw err;
        });
    }

    [_copyToBackup](isBackupTemplate) {
        let copyWorkTree = () => {

            return fs.emptyDir(this.backupWorkTreePath)
            .then(() => {
                return _filterChildrenAndCopy(
                    this.sourcePath,
                    this.backupWorkTreePath,
                    (sourceParentPath, sourceSubPath) => {
                        return sourceSubPath !== ".git";
                    }
                );
            });

        };

        let clearRepo = () => {
            return _filterChildrenAndRemove(
                this.backupRepoPath,
                (targetParentPath, targetSubPath) => {
                    return targetSubPath !== "objects";
                })
        };

        let copyRepo = () => {

            let sourceRepoPath = path.join(this.sourcePath, ".git");
            return _filterChildrenAndCopy(
                sourceRepoPath,
                this.backupRepoPath,
                (parentPath, subPath) => {
                    return subPath !== "objects";
                }
            );
        };

        let serializeIndex = () => {
            if (isBackupTemplate) {
                return git.Repository.open(this.sourcePath)
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
            path.join(this.sourcePath, ".git", "objects"),
            path.join(this.backupRepoPath, "objects"), 
            {
                overwrite: false,
                errorOnExit: false,
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
        .then(serializeIndex)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to serialize index from " + this.sourcePath);
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
        });
    }

    [_commitBackup](tagName) {

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

    [_copyToTarget](isTemplate) {

        let copyWorkTree = () => {

            return fs.emptyDir(this.sourcePath)
            .then(() => {
                return _filterChildrenAndCopy(
                    this.backupWorkTreePath,
                    this.sourcePath,
                    (parentPath, subPath) => {
                        return true;
                    }
                );
            });

        };

        let copyRepo = () => {

            let sourceRepoPath = path.join(this.sourcePath, ".git");

            return fs.ensureDir(sourceRepoPath)
            .then(() => {
                return _filterChildrenAndCopy(
                    this.backupRepoPath,
                    sourceRepoPath, 
                    (parentPath, subPath) => {
                        return subPath !== "objects" // skip "objects" because their timestamps cannot be preserved (will trigger EPERM)
                    }
                );
            })
            .then(() => {
                return fs.copy(
                    path.join(this.backupRepoPath, "objects"),
                    path.join(sourceRepoPath, "objects")
                );
            });

        };

        let restoreIndex = () =>{
            if (isTemplate) {

                let serializedIndexEntries;
                let index;

                return fs.readFile(this.indexFilePath)
                .then((dataString) => {
                    return serialization.deserializedIndex(dataString);
                })
                .then((serializedIndexEntriesResult) => {
                    serializedIndexEntries = serializedIndexEntriesResult;
                    return git.Repository.open(this.sourcePath, 0);
                })
                .then((sourceRepo) => {
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
                })
            }
            else {
                return Promise.resolve();
            }
        }

        let isBreaking = false;
        return copyWorkTree()
        .catch((err) => {
            console.error("Error happend when trying to copy work tree for " + this.sourcePath);
            isBreaking = true;
            return Promise.reject(err);
        })
        .then(copyRepo)
        .catch((err) => {
            if (!isBreaking) {
                console.error("Error happened when trying to restore repo to " + this.sourcePath + " from " + this.backupRepoPath);
                isBreaking = true;
            }
            
            return Promise.reject(err);
        })
        .then(restoreIndex)
        .catch((err) => {
            if (isBreaking) {
                console.error("Error happened when trying to restore index for " + this.sourcePath + " from " + this.indexFilePath);
                isBreaking = true;
            }

            return Promise.reject(err);
        });
    }

    [_compareRepoRevisions](sourceRepo, refRepo) {

        this.sourceRepoNodesCahce = this.sourceRepoNodesCahce || {};
        this.refRepoNodeCache = this.refRepoNodeCache || {};

        let sourceRefs, refRefs;

        return sourceRepo.getReferences(git.Reference.TYPE.LISTALL)
        .then(refsResult => {
            sourceRefs = refsResult;
            sourceRefs.sort((a, b) => {
                return a.name().compare(b.name());
            });
        })
        .then(() => {
            return refRepo.getReferences(git.Reference.TYPE.LISTALL)
            .then(refsResult => {
                refRefs = refsResult;
                refRefs.sort((a, b) => {
                    return a.name().compare(b.name());
                })
            })
        })
        .then(() => {
            if (sourceRefs.length === refRefs.length) {
                for (let i = 0; i < sourceRefs.length; i++) {
                    if (sourceRefs[i].name() !== refRefs[i].name()) {
                        return false;
                    }
                }

                let sourceNodes, refNodes;
                let buildNodes = [];
                sourceRefs.forEach(ref => {
                    buildNodes.push(
                        CommitNode.buildFromReference(sourceRepo, ref, this.sourceRepoNodesCahce)
                        .then(node => {
                            sourceNodes.push(node);
                        }));
                });
                refRefs.forEach(ref => {
                    buildNodes.push(
                        CommitNode.buildFromReference(refRepo, ref, this.refRepoNodeCache)
                        .then(node => {
                            refNodes.push(node);
                        }));                   
                })

                return Promise.all(buildNodes)
                .then(() => {
                    return _compareRepoNodes(sourceNodes, refNodes);
                });
            }
            else {
                return false;
            }
        })
    }
}