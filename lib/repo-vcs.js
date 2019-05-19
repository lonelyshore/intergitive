"use strict";

const vcs = require("./repo-vcs-implement");
const eol = require("./text-eol");

const hiddenCtor = Symbol("hiddenCtor");

exports.RepoCheckpointManager = class RepoCheckpointManager {

    static create(monitoredPath, checkpointStorePath, storeName, isCrLf) {
        let ret = new RepoCheckpointManager();
        return ret[hiddenCtor](monitoredPath, checkpointStorePath, storeName, isCrLf || eol.isCrLf())
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

    static create(monitoredPath, referenceStorePath, storeName, isCrLf) {
        let ret = new RepoReferenceManager();
        return ret[hiddenCtor](monitoredPath, referenceStorePath, storeName, isCrLf || eol.isCrLf())
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

    static create(sourcePath, referenceStorePath, storeName, isCrLf) {
        let ret = new RepoReferenceMaker();
        return ret[hiddenCtor](sourcePath, referenceStorePath, storeName, isCrLf || eol.isCrLf())
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