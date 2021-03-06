
"use strict";

const fs = require("fs-extra");
const path = require('path');
const assert = require('assert');

const readline = require('readline');

const git = require("./git-kit");
const serialization = require('./repo-serilization');
const normalizePathSep = require('./noarmalize-path-sep');

const GitStorage = require('./repo-storage/repo-git-storage');
const ArchiveStorage = require('./repo-storage/repo-archive-storage');


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
    let sourceBuff = [];
    let refBuff = [];
    let conclusion = true;

    let sourceRl, refRl;
    let sourceClosed = true;
    let refClosed = true;
    let sourceStreamClosed = true;
    let refStreamClosed = true;

    let isEmptyLine = (line) => {
        return line.trim().length === 0;
    }

    let consumeBuff = (buff, lines) => {
        while (buff.length !== 0) {
            let line = buff.shift();
            lines = lines.concat(line.split(' ').filter(token => !isEmptyLine(token)));
        }
        return lines;
    }

    let consumeBuffs = () => {

        sourceLines = consumeBuff(sourceBuff, sourceLines);
        refLines = consumeBuff(refBuff, refLines);

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
            sourceBuff.push(line);
            consumeBuffs();
        })
                
        sourceRl.on('close', () => {
            sourceClosed = true;
        })

        refRl.on('line', (line) => {
            refBuff.push(line);
            consumeBuffs();
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
                    sourceLines = consumeBuff(sourceBuff, sourceLines);
                    refLines = consumeBuff(refBuff, refLines);

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

    return conclusion &&
    sourceBuff.length === 0 &&
    sourceLines.length === 0 &&
    refBuff.length === 0 &&
    refLines.length === 0;
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
const _compareRepoRevisions = Symbol("_compareRepoRevisions");
const _compareRepoIndex = Symbol("_compareRepoIndex");
const _loadSerializedIndex = Symbol("_loadSerializedIndex");
const _compareWorkingTreeDiff = Symbol("_compareWorkingTreeDiff");
const _repairIndex = Symbol("_repairIndex");

const diffOptions = new git.DiffOptions();
diffOptions.flags = git.Diff.OPTION.INCLUDE_UNTRACKED | git.Diff.OPTION.IGNORE_WHITESPACE_EOL;

module.exports.textFilesEqual = sourceTextEquivalentToRefText;

module.exports.RepoVersionControl = class RepoVersionControl {

    /**
     * Used to backup and restore git repositories
     * @param {string} storesPath Base path to repository stores
     */
    constructor(storesPath, storage, isCrLf) {
        this.storesPath = storesPath;
        this.isCrLf = isCrLf;

        fs.ensureDirSync(this.storesPath);

        this.storage = storage;
    }

    /**
     * 
     * @param {string} sourcePath Path to the git repository that will be backuped from or restored to
     * @param {string} storeName Name to the backup store
     * @param {boolean} isRemote Is the source git repository a remote (bare) repository?
     */
    setTarget(sourcePath, storeName, isRemote) {

        this.sourcePath = sourcePath;
        this.isRemote = isRemote;

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
        if (this.isRemote) {
            return this.storage.saveRemote(tagName, this.sourcePath);
        }
        else {
            return this.storage.saveLocal(tagName, this.sourcePath, isTemplate);
        }
    }
    
    /**
     * 
     * @param {string} tagName 
     * @param {boolean} isTemplate Is restore from a template
     */
    restore(tagName, isTemplate) {
        if (this.isRemote) {
            return this.storage.loadRemote(tagName, this.sourcePath);
        }
        else {
            return this.storage.loadLocal(tagName, this.sourcePath, isTemplate);
        }
        
    }

    contains(tagName) {
        return this.storage.contains(tagName);
    }

    diffWithTemplate(tagName) {

        if (this.isRemote) {
            return this.diffWithTemplateRemote(tagName);
        }
        else {
            return this.diffWithTemplateLocal(tagName);
        }


    }

    diffWithTemplateLocal(tagName) {

        let referenceWorkingPath;
        let serializedIndexEntries;

        let referenceRepo;
        let loadReferenceRepo = () => {
            return git.Repository.open(referenceWorkingPath)
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

        return fs.exists(path.join(this.sourcePath, '.git'))
        .then(result => {
            if (!result) {
                areEqual = false;
            }
        })
        .then(() => {
            if (areEqual) {
                return this.storage.loadLocalToCache(tagName);
            }
            else{
                return Promise.resolve();
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when checkout tag " + tagName + " for repo " + this.storage.storePath);
                console.error(err);
                isBreaking = true;
            }

            throw err;
        })
        .then((result) => {
            if (areEqual) {
                referenceWorkingPath = result.cachingPath;
                serializedIndexEntries = result.serializedIndexEntries
    
                return loadReferenceRepo(referenceWorkingPath)
                .then(loadSourceRepo)
                .then(() => this[_compareRepoRevisions](sourceRepo, referenceRepo))
                .then(result => {
                    if (!result) {
                        areEqual = false
                    }
                });
            }
            else {
                return Promise.resolve();
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing repo revisions between " + this.sourcePath + " and " + referenceWorkingPath);
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
                return this[_compareRepoIndex](sourceRepo, serializedIndexEntries)
                .then(result => {
                    if (!result) {
                        areEqual = false;
                    }
                });
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happened when comparing repo indices between " + this.sourcePath + " and " + referenceWorkingPath);
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
                return this[_compareWorkingTreeDiff](sourceRepo, referenceRepo, referenceWorkingPath)
                .then(result => {
                    if (!result) {
                        areEqual = false;
                    }
                });
            }
        })
        .then(() => {
            if (!areEqual) {
                return Promise.resolve();
            }
            else {
                return diffRemoteSettings(
                    sourceRepo,
                    this.sourcePath,
                    referenceRepo,
                    referenceWorkingPath
                )
                .then(result => {
                    if (!result) {
                        areEqual = false;
                    }
                });
            }
        })
        .finally(() => {
            try{
                if (sourceRepo)
                    sourceRepo.cleanup();
                
                if (referenceRepo)
                    referenceRepo.cleanup();
            }
            catch(e) {
                console.error(e);
            }
        })
        .catch(err => {
            if (!isBreaking) {
                console.error("Error happend when comparing repo working tree diff between " + this.sourcePath + " and " + referenceWorkingPath);
                console.log(err.stack);
                isBreaking = true;
            }

            throw err;
        })
        .then(() => areEqual);

        function diffRemoteSettings(sourceRepo, sourceRepoPath, referenceRepo, referenceRepoPath) {

            return Promise.all([
                getNormalizedRemoteSetting(sourceRepo, sourceRepoPath),
                getNormalizedRemoteSetting(referenceRepo, referenceRepoPath)
            ])
            .then(remoteSettings => {
                return compareNormalizedRemoteSettings(
                    remoteSettings[0],
                    remoteSettings[1]
                );
            });

            function getNormalizedRemoteSetting(repo, repoPath) {
                return git.Remote.list(repo)
                .then(remoteNames => {

                    let collectRemoteMappingPromise = Promise.resolve();

                    let remoteMapping = {};

                    remoteNames.sort(
                        (a, b) => a.name().localeCompare(b.name())
                    )
                    .forEach(remoteName => {
                        collectRemoteMappingPromise = collectRemoteMappingPromise
                        .then(() => {
                            return git.Remote.lookup(repo, remoteName)
                            .then(remote => {
                                remoteMapping[remote.name()] = normalizeUrl(remote.url(), repoPath);
                            });
                        });
                    });

                    return collectRemoteMappingPromise
                    .then(() => remoteMapping);
                });

                function normalizeUrl(url, basePath) {
                    if (url) {
                        if (path.isAbsolute(url)) {
                            return normalizePathSep.posix(path.relative(basePath, url));
                        }
                        else {
                            return normalizePathSep.posix(url);
                        }
                    }
                    else {
                        return '';
                    }
                }
            }

            function compareNormalizedRemoteSettings(lhs, rhs) {
                let lhsKeys = Object.keys(lhs) ;

                if (lhsKeys.length !== Object.keys(rhs).length) {
                    return false;
                }
                else {
                    return lhsKeys.every(key => {
                        return lhs[key] === rhs[key];
                    });
                }
            }
        }
    }

    diffWithTemplateRemote(tagName) {

        let areEqual = true;
        let sourceRepo;
        let refRepo;

        return Promise.all([
            fs.exists(path.join(this.sourcePath, 'objects')),
            fs.exists(path.join(this.sourcePath, 'refs')),
            fs.exists(path.join(this.sourcePath, 'HEAD'))
        ])
        .then(results => {
            areEqual = results.every(v => v === true);
        })
        .then(() => {
            if (areEqual) {
                return git.Repository.openBare(this.sourcePath)
                .then(result => {
                    sourceRepo = result;
                })
                .catch(err => {
                    console.error(`Failed to load repository for source: ${this.sourcePath}`);
                    return Promise.reject(err);
                })
                .then(() => {
                    return this.storage.loadRemoteToCache(tagName)
                    .then(result => {
                        return git.Repository.openBare(result);
                    })
                    .then(result => {
                        refRepo = result;
                    })
                    .catch(err => {
                        console.error(`Failed to load repository for ref: ${this.storesPath}; ${tagName}`);
                        return Promise.reject(err);
                    });
                })
            }
            else {
                return Promise.resolve();
            }
        })
        .then(() => {
            if (areEqual) {
                return this[_compareRepoRevisions](sourceRepo, refRepo)
                .then(result => {
                    if (!result) {
                        areEqual = false
                    }
                })
                .catch(err => {
                    console.error(`Error occured when comparing repo revisions ${tagName}`);
                    return Promise.reject(err);
                });
            }
            else {
                return Promise.resolve();
            }
        })
        .catch(err => {
            console.error(err);
            return Promise.reject(err);
        })
        .finally(() => {
            try{
                if (sourceRepo)
                    sourceRepo.cleanup();
                
                if (refRepo)
                    refRepo.cleanup();
            }
            catch(e) {
                console.error(e);
            }
        })
        .then(() => {
            return areEqual;
        });
    }

    [_compareRepoRevisions](sourceRepo, refRepo) {

        this.sourceRepoNodesCahce = this.sourceRepoNodesCahce || {};
        this.refRepoNodeCache = this.refRepoNodeCache || {};

        let sourceRefs, refRefs;

        let inequalError = 'inequal';

        return sourceRepo.getReferences()
        .then(refsResult => {
            sourceRefs = refsResult;
            sourceRefs.sort((a, b) => {
                return a.name().localeCompare(b.name());
            });
        })
        .then(() => {
            if (sourceRepo.headUnborn() === 0) {
                return sourceRepo.head()
                .then(head => { 
                    sourceRefs.push(head);
                });
            }
        })
        .then(() => refRepo.getReferences())
        .then(refsResult => {
            refRefs = refsResult;
            refRefs.sort((a, b) => {
                return a.name().localeCompare(b.name());
            });
        })
        .then(() => {
            if (refRepo.headUnborn() === 0) {
                return refRepo.head()
                .then(head => refRefs.push(head));
            }
        })
        .then(() => {
            if (sourceRefs.length !== refRefs.length) {
                throw new Error(inequalError);
            }
        })
        .then(() => {
            assert(sourceRefs.length === refRefs.length);

            for (let i = 0; i < sourceRefs.length; i++) {
                if (sourceRefs[i].name() !== refRefs[i].name()) {
                    throw new Error(inequalError);
                }
            }
        })
        .then(() => {
            function abstractRefPositions(repo, refs) {

                let positionMap = {};
                let positionAbstractions = [];

                let collectPositions = Promise.resolve();
                let count = 0;

                refs.forEach(ref => {
                    collectPositions = collectPositions.then(() => {
                        return repo.getReferenceCommit(ref)
                        .then(commit => {
                            let sha = commit.sha();
                            if (sha in positionMap) {
                                positionAbstractions.push(positionMap[sha])
                            }
                            else {
                                positionMap[sha] = count;
                                positionAbstractions.push(count);
                                count++;
                            }
                        });
                    });
                });

                return collectPositions
                .then(() => {
                    return positionAbstractions;
                });
            }

            let sourceRefPositions, refRefPositions;

            return abstractRefPositions(sourceRepo, sourceRefs)
            .then(positions => {
                sourceRefPositions = positions;
            })
            .then(() => abstractRefPositions(refRepo, refRefs))
            .then(positions => {
                refRefPositions = positions;
            })
            .then(() => {
                assert(sourceRefPositions.length === refRefPositions.length);

                for (let i = 0; i < sourceRefPositions.length; i++) {
                    if (sourceRefPositions[i] !== refRefPositions[i]) {
                        throw new Error(inequalError);
                    }
                }
            })
        })
        .then(() => {
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
        })
        .catch(err => {
            if (err.message === inequalError) {
                return false;
            }
            else {
                throw err;
            }
        });
    }

    [_compareRepoIndex](sourceRepo, serializedIndexEntries) {

        return sourceRepo.refreshIndex()
        .then(index => {
            return _compareIndexWithSerializedIndex(index, serializedIndexEntries);
        });
    }

    [_compareWorkingTreeDiff](sourceRepo, referenceRepo, referenceWorkingPath) {

        let sourceIndex;
        let referenceIndex;
        let sourceDiff;
        let referenceDiff;

        return Promise.resolve()
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
                _dirtyWorkTreeEqualRefWorkTree(sourceDiff, this.sourcePath, referenceWorkingPath),
                _dirtyWorkTreeEqualRefWorkTree(referenceDiff, referenceWorkingPath, this.sourcePath)
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