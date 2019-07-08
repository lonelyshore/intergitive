"use strict";

const vcs = require("./repo-vcs-implement");
const eol = require("./text-eol");
const readonly = require('./readonly');

const RepoStorage = require('./repo-storage/repo-storage');
const GitStorage = require('./repo-storage/repo-git-storage');
const ArchiveStorage = require('./repo-storage/repo-archive-storage');

const hiddenCtor = Symbol("hiddenCtor");

/**
 * Enum
 * @readonly
 * @enum {number}
 */
const STORAGE_TYPE = readonly.wrap({
    GIT: 0,
    ARCHIVE: 1
});

/**
 * 
 * @param {STORAGE_TYPE} storageType 
 * @returns {RepoStorage}
 */
function createStorage(storageType, isAutoCrlf) {
    switch(storageType) {
        case STORAGE_TYPE.GIT:
            return new GitStorage(isAutoCrlf);
        
        case STORAGE_TYPE.ARCHIVE:
            return new ArchiveStorage(isAutoCrlf);

        default:
            throw new Error(`Unhandled storage type ${storageType}`);
    }
}

exports.STORAGE_TYPE = STORAGE_TYPE;

exports.RepoCheckpointManager = class RepoCheckpointManager {

    static create(monitoredPath, checkpointStorePath, storeName, storageType, isCrLf) {
        isCrLf = isCrLf || eol.isCrLf();
        let ret = new RepoCheckpointManager(createStorage(storageType));
        return ret[hiddenCtor](monitoredPath, checkpointStorePath, storeName, isCrLf)
        .then(() => ret);
    }    

    constructor() {
    }

    [hiddenCtor](monitoredPath, checkpointStorePath, storeName, isCrLf) {
        this.backend = new vcs.RepoVersionControl(checkpointStorePath, isCrLf);
        return this.backend.setTarget(monitoredPath, storeName);
    }

    backup(checkpointName) {
        return this.backend.backup(checkpointName, false);
    }

    restore(checkpointName) {
        return this.backend.restore(checkpointName, false);
    }

};

exports.RepoReferenceManager = class RepoReferenceManager {

    static create(monitoredPath, referenceStorePath, storeName, storageType, isCrLf) {
        isCrLf = isCrLf || eol.isCrLf();
        let ret = new RepoReferenceManager(createStorage(storageType));
        return ret[hiddenCtor](monitoredPath, referenceStorePath, storeName, isCrLf)
        .then(() => ret);
    }   

    constructor() {
    }

    [hiddenCtor](monitoredPath, referenceStorePath, storeName, isCrLf) {
        this.backend = new vcs.RepoVersionControl(referenceStorePath, isCrLf);
        return this.backend.setTarget(monitoredPath, storeName);
    }

    /**
     * 
     * @param {string} referenceVersionName 
     */
    equivalent(referenceName) {
        return this.backend.diffWithTemplate(referenceName);
    }

    restore(referenceName) {
        return this.backend.restore(referenceName, true);
    }
};

exports.RepoReferenceMaker = class RepoReferenceMaker {

    static create(sourcePath, referenceStorePath, storeName, storageType, isCrLf) {
        isCrLf = isCrLf || eol.isCrLf();
        let ret = new RepoReferenceMaker(createStorage(storageType, isCrLf));
        return ret[hiddenCtor](sourcePath, referenceStorePath, storeName, isCrLf)
        .then(() => ret);
    }

    [hiddenCtor](sourcePath, referenceStorePath, storeName, isCrLf) {
        this.backend = new vcs.RepoVersionControl(referenceStorePath, isCrLf);
        return this.backend.setTarget(sourcePath, storeName);

    }

    save(referenceName) {
        return this.backend.backup(referenceName, true);
    }

}