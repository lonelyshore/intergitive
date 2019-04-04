"use strict";

const vcs = require("./repo-vcs-implement");

class RepoCheckpointManagerImpl {
    constructor(checkpointStorePath) {
        this.backend = new vcs.RepoVersionControl(checkpointStorePath);
    }

    init(monitoredPath, storeName) {
        return this.backend.setTarget(monitoredPath, storeName);
    }

    backup(checkpointName) {

    }
}

const hiddenCtor = Symbol("hiddenCtor");

exports.RepoCheckpointManager = class RepoCheckpointManager {

    static create(monitoredPath, checkpointStorePath, storeName) {
        let ret = new RepoCheckpointManager();
        return ret[hiddenCtor](monitoredPath, checkpointStorePath, storeName);
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
        let ret = new RepoReferenceMaker();
        return ret[hiddenCtor](monitoredPath, referenceStorePath, referenceName);
    }

    [hiddenCtor](monitoredPath, referenceStorePath, referenceName) {
        this.backend = new vcs.RepoVersionControl(referenceStorePath);
        return this.backend.setTarget(monitoredPath, referenceName);
    }

    diff(referenceVersionName) {
        return this.backend.diffWithTemplate(referenceVersionName);
    }

    restore(referenceVersionName) {
        return this.backend.restore(referenceVersionName, true);
    }
}

exports.RepoReferenceMaker = class RepoReferenceMaker {

    static create(sourcePath, storePath, referenceName) {

    }

    save(referenceVersionName) {

    }

}