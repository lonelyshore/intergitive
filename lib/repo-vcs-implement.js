
"use strict";

const fs = require("fs-extra");
const git = require("./git-kit");
const path = require('path');
const assert = require('assert');
const serialization = require('./repo-serilization');
const readline = require('readline');

const GitStorage = require('./repo-storage/repo-git-storage');





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
            return CommitNode.buildFromCommit(commit, cache);
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

            let parentCount = commit.parentcount();
            if (parentCount === 0) {
                newNode.previouses = null;
                return Promise.resolve(newNode);
            }
            else {
                let previouses = newNode.previouses;
                let getPreviouses = [];

                previouses.length = parentCount;
                for (let i = 0; i < parentCount; i++) {
                    getPreviouses.push(
                        commit.parent(i)
                        .then((parentCommit) => {
                            return CommitNode.buildFromCommit(parentCommit, cache);
                        })
                        .then(parentNode => {
                            previouses[i] = parentNode;
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
        return this.treeId === other.treeId && this.previousesEquals(other.previouses);
    }

    previousesEquals(otherPreviouses) {
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
    
    for (let i = 0; i < repoNodes.length; i++) {
        if (!repoNodes[i].equals(refNodes[i])) {
            return false;
        }
    }
    
    return true;
}

function _countObjectNumber(repoPath) {

    let repoObjectPath = path.join(repoPath, "objects");

    let repoObjectCount = 0;
    let paths = [];
    return fs.readdir(repoObjectPath)
    .then((childPaths) => {
        let expands = [];
        childPaths.forEach((childPath) => {
            let fullPath = path.join(repoObjectPath, childPath);

            expands.push(
                Promise.resolve()
                .then(() => {
                    return fs.stat(fullPath);
                })
                .then(stat => {
                    if (stat.isDirectory()) {
                        return fs.readdir(fullPath)
                        .then(subPaths => {
                            paths = paths.concat(subPaths.map(e => childPath + e));
                            repoObjectCount += subPaths.length;
                        });
                    }
                    else {
                        paths.push(fullPath);
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

/**
 * 
 * @param {git.Index} index 
 * @param {Array<serialization.SerializedIndexEntries>} serializedIndexEntries 
 */
function _compareIndexWithSerializedIndex(index, serializedIndexEntries) {
    let dict = {};
    serializedIndexEntries.forEach(e => {
        let samePaths = dict[e.path] || {};
        samePaths[e.id] = e;

        dict[e.path] = samePaths;
    });

    for (let i = 0; i < index.entryCount(); i++) {
        let entry = index.getByIndex(i);
        let samePaths = dict[entry.path];

        if (!samePaths) {
            return false;
        }
        else {
            let serializedEntry = samePaths[entry.id];
            if (!serializedEntry || !serializedEntry.equals(entry)) {
                return false;
            }
            else {
                delete samePaths[entry.id];
                if (Object.keys(samePaths).length === 0) {
                    delete dict[entry.path];
                }
            }
        }
    }

    return Object.keys(dict).length === 0;
}

/**
 * Should be using fs.read and Buffer.equal, but I'm lazy...
 * @param {string} sourceFilePath 
 * @param {string} refFilePath 
 */
function _sourceFileBitwiseEqualsRefFile(sourceFilePath, refFilePath) {
    return Promise.all([
        git.Odb.hashfile(sourceFilePath, git.Object.TYPE.BLOB),
        git.Odb.hashfile(refFilePath, git.Object.TYPE.BLOB)
    ])
    .then(hashes => {
        return hashes[0].equal(hashes[1]);
    });
}

async function sourceTextEquivalentToRefText(sourceTextPath, refTextPath) {
    let sourceLines = [];
    let refLines = [];
    let conclusion = true;

    let sourceRl, refRl;
    let sourceClosed = true;
    let refClosed = true;
    let sourceStreamClosed = true;
    let refStreamClosed = true;

    let consumeLines = () => {
        while (sourceLines.length !== 0 && refLines.length !== 0) {
            if (sourceLines.shift() !== refLines.shift()) {
                conclusion = false;
                sourceRl.close();
                refRl.close();
                return;
            }
        }
    }

    let sourceStream = fs.createReadStream(sourceTextPath);
    sourceStreamClosed = false;

    let refStream = fs.createReadStream(refTextPath);
    refStreamClosed = false;
    
    sourceStream.on('close', () => {
        sourceStreamClosed = true;
    });
    refStream.on('close', () => {
        refStreamClosed = true;
    })
    try {
        
        sourceRl = readline.createInterface({
            input: sourceStream,
            crlfDelay: Infinity
        });

        sourceClosed = false;

        refRl = readline.createInterface({
            input: refStream,
            crlfDelay: Infinity
        });

        refClosed = false;

        sourceRl.on('line', (line) => {
            sourceLines.push(line);
            consumeLines();
        })
                
        sourceRl.on('close', () => {
            sourceClosed = true;
        })

        refRl.on('line', (line) => {
            refLines.push(line);
            consumeLines();
        })
        
        refRl.on('close', () => {
            refClosed = true;
        })

        let waitFilesClosed = () => {
            return new Promise(resolve => {
                if (!sourceClosed || !refClosed) {
                    setTimeout(() => waitFilesClosed().then(resolve), 1);
                }
                else {
                    while (sourceLines.length !== 0 && refLines.length !== 0) {
                        if (sourceLines.shift() !== refLines.shift()) {
                            conclusion = false;
                        }
                    }
                    resolve();
                }
            })
        };

        await waitFilesClosed();

        
    } 
    catch(err) {
        console.error(err);
        throw err;
    }
    finally {
        
        sourceRl.close();
        refRl.close();
        sourceStream.destroy();
        refStream.destroy();
    }

    let checkAllClosed = () => {
        return new Promise(resolve => {
            if (!sourceClosed || !refClosed || !sourceStreamClosed || !refStreamClosed) {
                setTimeout(() => checkAllClosed().then(resolve), 1);
            }
            else {
                resolve();
            }
        })
    };

    await checkAllClosed();

    return conclusion && sourceLines.length === 0 && refLines.length === 0;
}

function _sourceFileEqualsRefFile(sourceFilePath, refFilePath, sourceIsText) {
    return Promise.all([
        fs.exists(sourceFilePath),
        fs.exists(refFilePath)
    ])
    .then(exists => {
        if (exists[0] === exists[1]) {
            if (exists[0] === true) {
                if (sourceIsText) {
                    return sourceTextEquivalentToRefText(sourceFilePath, refFilePath);
                }
                else {
                    return _sourceFileBitwiseEqualsRefFile(sourceFilePath, refFilePath);
                }
            }
            else {
                return true;
            }
        }
        else {
            return false;
        }
    });
}

function _dirtyWorkTreeEqualRefWorkTree(sourceDiff, sourcePath, refPath) {
    let compareHashes = Promise.resolve(true);
    for (let i = 0; i < sourceDiff.numDeltas(); i++) {
        let diff = sourceDiff.getDelta(i);
        let diffFilePath = diff.newFile().path();

        compareHashes = compareHashes
        .then(previousEqual => {
            if (previousEqual) {
                return _sourceFileEqualsRefFile(
                    path.join(sourcePath, diffFilePath),
                    path.join(refPath, diffFilePath),
                    diff.newFile().mode() === git.TreeEntry.FILEMODE.BLOB
                );
            }
        });
    }

    return compareHashes;    
}

function _compareDiffs(diff, otherDiff) {
    if (diff.numDeltas() !== otherDiff.numDeltas()) {
        return Promise.resolve(false);
    }
    else {
        return new Promise((resolve, reject) => {
            let otherDiffFiles = {};
            
            for (let i = 0; i < otherDiff.numDeltas(); i++) {
                let diffFile = otherDiff.getDelta(i).newFile();
                otherDiffFiles[diffFile.path()] = diffFile;
            }

            for (let i = 0; i < diff.numDeltas(); i++) {
                let diffFile = diff.getDelta(i).newFile();
                let otherDiffFile = otherDiffFiles[diffFile.path()];
                if (!otherDiffFile
                    || !diffFile.id().equal(otherDiffFile.id())) {
                    resolve(false);
                }
            }

            resolve(true);
        });
    }
}

const _repo = Symbol('_repo');
const _copyToBackup = Symbol("_copyToBackup");
const _commitBackup = Symbol("_commitBackup");
const _copyToTarget = Symbol("_copyToTarget");
const _ensurePreserveMode = Symbol("_ensurePreserveMode");
const _compareRepoRevisions = Symbol("_compareRepoRevisions");
const _compareRepoIndex = Symbol("_compareRepoIndex");
const _loadSerializedIndex = Symbol("_loadSerializedIndex");
const _compareWorkingTreeDiff = Symbol("_compareWorkingTreeDiff");
const _repairIndex = Symbol("_repairIndex");

const gitRepoFolderName = ".git";
const gitConfigFileSubPath = path.join('.git', 'config');
const diffOptions = new git.DiffOptions();
diffOptions.flags = git.Diff.OPTION.INCLUDE_UNTRACKED | git.Diff.OPTION.IGNORE_WHITESPACE_EOL;

module.exports.textFilesEqual = sourceTextEquivalentToRefText;

module.exports.RepoVersionControl = class RepoVersionControl {

    static get wrapperFolderName() { return "wrapper"; }
    static get repoFolderName() { return "_git_"; }
    //static get workTreeFolderName() { return "work_tree"; }
    static get indexFileName() { return "index_serialization"; }

    /**
     * Used to backup and restore git repositories
     * @param {string} storesPath Base path to repository stores
     */
    constructor(storesPath, isCrLf) {
        this.storesPath = storesPath;
        this.isCrLf = isCrLf;

        fs.ensureDirSync(this.storesPath);

        this.storage = new GitStorage();
    }

    /**
     * 
     * @param {string} sourcePath Path to the git repository that will be backuped from or restored to
     * @param {string} storeName Name to the backup store
     */
    setTarget(sourcePath, storeName) {

        let asserts = () => {
            return Promise.resolve()
            .then(() => {
                assert(fs.existsSync(this.storesPath), `storePath ${this.storesPath} does not exist`);
            });
        };
        
        let init = () => {
            this.sourcePath = sourcePath;
            this.storePath = path.join(this.storesPath, storeName);
            this.backupWorkTreePath = path.join(this.storePath, RepoVersionControl.wrapperFolderName);
            this.backupRepoPath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, RepoVersionControl.repoFolderName);
            this.referenceGitRepoPath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, gitRepoFolderName);
            this.indexFilePath = path.join(this.storePath, RepoVersionControl.wrapperFolderName, RepoVersionControl.indexFileName);
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

        this.sourcePath = sourcePath;

        return this.storage.setStorePath(
            path.join(this.storesPath, storeName)
        );
    }

    /**
     * 
     * @param {string} tagName Code name for the backup, used to restore later
     * @param {boolean} isTemplate Is backup for template
     * @returns {Promise<void>}
     */
    backup(tagName, isTemplate) {
        return this.storage.save(tagName, this.sourcePath, isTemplate);
    }
    
    /**
     * 
     * @param {string} tagName 
     * @param {boolean} isTemplate Is restore from a template
     */
    restore(tagName, isTemplate) {

        return this.storage.load(tagName, this.sourcePath, isTemplate);

        let assertPaths = () => {
            return Promise.resolve()
            .then(() => {
                assert(fs.existsSync(this.storePath), `storePath ${this.storePath} does not exist`);
                assert(fs.existsSync(path.join(this.storePath, '.git')), `expect storePath to have .git folder, but it does not`);
            });
        };
        
        let repo = this[_repo];

        assert(!repo.isEmpty(), "repo is empty");

        let checkoutTag = () => {
            return this[_ensurePreserveMode]()
            .then(() => {
                return git.Commands.cleanCheckoutRef(repo, tagName);
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
                console.error("Error occured when checkout tag <" + tagName + ">");
                console.error(err);
                isBreaking = true;
            }

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

        return Promise.reject(new Error('under construction'));

        assert(fs.existsSync(this.sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));
        
        let repo = this[_repo];

        assert(!repo.isEmpty(), "template is empty");

        let checkoutTag = () => {

            return this[_ensurePreserveMode]()
            .then(() => {
                return git.Commands.cleanCheckoutRef(repo, tagName);
            })
            .then(() => {
                return fs.rename(this.backupRepoPath, this.referenceGitRepoPath);
            })
            .then(() => {
                let configPath = path.join(this.backupWorkTreePath, gitConfigFileSubPath);
                return fs.exists(configPath)
                .then(exists => {
                    if (!exists) {
                        return fs.createFile(configPath);
                    }
                    else {
                        return Promise.resolve();
                    }
                })
                .then(() => {
                    return git.Config.openOndisk(configPath);
                })
                .then(config => {
                    return config.setString('core.autocrlf', this.isCrLf ? 'true' : 'input');
                });
            });

        };

        let referenceRepo;
        let loadReferenceRepo = () => {
            return git.Repository.open(this.referenceGitRepoPath)
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
        let areEqual = true;
        return checkoutTag()
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when checkout tag " + tagName + " for repo " + this.storePath);
                isBreaking = true;
            }

            throw err;
        })
        .then(() => {
            return loadReferenceRepo()
            .then(loadSourceRepo)
            .then(() => this[_compareRepoRevisions](sourceRepo, referenceRepo))
            .then(result => {
                if (!result) {
                    areEqual = false
                }
            });
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing repo revisions between " + this.sourcePath + " and " + this.backupRepoPath);
                console.log(err.stack);
                isBreaking = true;
            }
            
            throw err;
        })
        .then(() => {
            if (!areEqual) {
                return Promise.resolve();
            }
            else {
                return this[_compareRepoIndex](sourceRepo)
                .then(result => {
                    if (!result) {
                        areEqual = false;
                    }
                });
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing repo indices between " + this.sourcePath + " and " + this.backupRepoPath);
                console.log(err.stack);
                isBreaking = true;
            }
            
            throw err;
        })
        .then(() => {
            if (!areEqual) {
                return Promise.resolve();
            }
            else {
                return fs.remove(this.indexFilePath)
                .then(() => this[_compareWorkingTreeDiff](sourceRepo, referenceRepo))
                .then(result => {
                    if (!result) {
                        areEqual = false;
                    }
                });
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happend when comparing repo working tree diff between " + this.sourcePath + " and " + this.backupRepoPath);
                console.log(err.stack);
                isBreaking = true;
            }

            throw err;
        })
        .then(() => areEqual);
    }


    [_compareRepoRevisions](sourceRepo, refRepo) {

        this.sourceRepoNodesCahce = this.sourceRepoNodesCahce || {};
        this.refRepoNodeCache = this.refRepoNodeCache || {};

        let sourceRefs, refRefs;

        return sourceRepo.getReferences(git.Reference.TYPE.LISTALL)
        .then(refsResult => {
            sourceRefs = refsResult;
            sourceRefs.sort((a, b) => {
                return a.name().localeCompare(b.name());
            });
        })
        .then(() => sourceRepo.head())
        .then(head => sourceRefs.push(head))
        .then(() => refRepo.getReferences(git.Reference.TYPE.LISTALL))
        .then(refsResult => {
            refRefs = refsResult;
            refRefs.sort((a, b) => {
                return a.name().localeCompare(b.name());
            });
        })
        .then(() => refRepo.head())
        .then(head => refRefs.push(head))
        .then(() => {
            if (sourceRefs.length === refRefs.length) {
                for (let i = 0; i < sourceRefs.length; i++) {
                    if (sourceRefs[i].name() !== refRefs[i].name()) {
                        return false;
                    }
                }

                let sourceNodes = []
                let refNodes = [];
                let buildNodes = Promise.resolve();

                sourceNodes.length = sourceRefs.length;
                refNodes.length = refRefs.length;
                
                sourceRefs.forEach((ref, index) => {
                    buildNodes = buildNodes.then(() => {
                        return CommitNode.buildFromReference(sourceRepo, ref, this.sourceRepoNodesCahce)
                        .then(node => {
                            sourceNodes[index] = node;
                        });
                    });
                });
                refRefs.forEach((ref, index) => {
                    buildNodes = buildNodes.then(() => {
                        return CommitNode.buildFromReference(refRepo, ref, this.refRepoNodeCache)
                        .then(node => {
                            refNodes[index] = node;
                        })
                    });                   
                })

                return buildNodes
                .then(() => {
                    return _compareRepoNodes(sourceNodes, refNodes);
                });
            }
            else {
                return false;
            }
        })
    }

    [_compareRepoIndex](sourceRepo) {

        let index;

        return sourceRepo.refreshIndex()
        .then(indexResult => {
            index = indexResult;
        })
        .then(() => this[_loadSerializedIndex]())
        .then(serializedIndexEntries => {
            return _compareIndexWithSerializedIndex(index, serializedIndexEntries);
        });
    }

    [_loadSerializedIndex]() {
        return fs.readFile(this.indexFilePath)
        .then((dataString) => {
            return serialization.deserializedIndex(dataString);
        });
    }

    [_compareWorkingTreeDiff](sourceRepo, referenceRepo) {

        let sourceIndex;
        let referenceIndex;
        let sourceDiff;
        let referenceDiff;

        return Promise.resolve()
        .then(() => {
            return this[_repairIndex](referenceRepo);
        })
        .then(() => {
            return referenceRepo.refreshIndex()
            .then(result => {
                referenceIndex = result;
            })
            .then(() => sourceRepo.refreshIndex())
            .then(result => {
                sourceIndex = result;
            });
        })
        .then(() => {
            return git.Diff.indexToWorkdir(sourceRepo, sourceIndex, diffOptions)
            .then(result => {
                sourceDiff = result;
            })
            .then(() => git.Diff.indexToWorkdir(referenceRepo, referenceIndex, diffOptions))
            .then(result => {
                referenceDiff = result;
            });
        })
        .then(() => {
            return Promise.all([
                _dirtyWorkTreeEqualRefWorkTree(sourceDiff, this.sourcePath, this.backupWorkTreePath),
                _dirtyWorkTreeEqualRefWorkTree(referenceDiff, this.backupWorkTreePath, this.sourcePath)
            ])
            .then(results => results[0] && results[1])
        })
    }

    [_repairIndex](referenceRepo) {
        return this[_repo].refreshIndex()
        .then(repoIndex => {
            let correctSizeMap = {};
            repoIndex.entries().forEach(entry => {
                if (entry.fileSize !== 0) {
                    correctSizeMap[entry.path] = entry.fileSize;
                }
            });
            
            return referenceRepo.refreshIndex()
            .then(refIndex => {
                refIndex.entries().forEach(entry => {
                    let correctSize = correctSizeMap['wrapper/' + entry.path];
                    if (entry.fileSize !== 0 && correctSize) {
                        entry.fileSize = correctSize;
                    }
                });

                return refIndex.write();
            })
        });
    }
}