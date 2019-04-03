"use strict";

const vcs = require("./repo-vcs-implement");

exports.RepoCheckpointManager = class RepoCheckpointManager {

    static create(monitoredPath, checkpointStorePath, storeName) {

    }

    backup(checkpointName) {

    }

    restore(checkpointName) {

    }

};

exports.RepoReferenceManager = class RepoReferenceManager {

    static create(monitoredPath, referenceStorePath, referenceName) {

    }

    diff(referenceVersionName) {

    }

    restore(referenceVersionName) {

    }
}

exports.RepoReferenceMaker = class RepoReferenceMaker {

    static create(sourcePath, storePath, referenceName) {

    }

    save(referenceVersionName) {
        
    }

}