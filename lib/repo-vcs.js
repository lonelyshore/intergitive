"use strict";

const vcs = require("./repo-vcs-implement");

const hiddenCtor = Symbol("hiddenCtor");

exports.RepoCheckpointManager = class RepoCheckpointManager {

    static create(monitoredPath, checkpointStorePath, storeName) {
        let ret = new RepoCheckpointManager();
        return ret[hiddenCtor](monitoredPath, checkpointStorePath, storeName)
        .then(() => ret);
    }

    constructor() {
    }

    [hiddenCtor](monitoredPath, checkpointStorePath, storeName) {
        this.backend = new vcs.RepoVersionControl(checkpointStorePath);
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

    static create(monitoredPath, referenceStorePath, referenceName) {
        let ret = new RepoReferenceManager();
        return ret[hiddenCtor](monitoredPath, referenceStorePath, referenceName)
        .then(() => ret);
    }

    constructor() {

    }

    [hiddenCtor](monitoredPath, referenceStorePath, referenceName) {
        this.backend = new vcs.RepoVersionControl(referenceStorePath);
        return this.backend.setTarget(monitoredPath, referenceName);
    }

    /**
     * 
     * @param {string} referenceVersionName 
     */
    diff(referenceVersionName) {
        return this.backend.diffWithTemplate(referenceVersionName);
    }

    restore(referenceVersionName) {
        return this.backend.restore(referenceVersionName, true);
    }
};

exports.RepoReferenceMaker = class RepoReferenceMaker {

    static create(sourcePath, storePath, referenceName) {
        let ret = new RepoReferenceMaker();
        return ret[hiddenCtor](sourcePath, storePath, referenceName)
        .then(() => ret);
    }

    [hiddenCtor](sourcePath, storePath, referenceName) {
        this.backend = new vcs.RepoVersionControl(storePath);
        return this.backend.setTarget(sourcePath, referenceName);

    }

    save(referenceVersionName) {
        return this.backend.backup(referenceVersionName, true);
    }

}