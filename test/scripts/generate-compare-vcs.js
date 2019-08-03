"use strict";

const fs = require("fs-extra");
const path = require("path");
const utils = require('../tests/test-utils');
const zip = require("../../lib/simple-archive");
const STORAGE_TYPE = require('../../lib/repo-vcs').STORAGE_TYPE;
const RefMaker = require('../../lib/repo-vcs').RepoReferenceMaker;

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-testing-ref-repo.yaml");

const storageType = STORAGE_TYPE.ARCHIVE;

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const refStorePath = path.join(workingPath, "repo-store");
const refName = `compare-vcs-local-ref-${STORAGE_TYPE.toString(storageType)}`;

let refMaker;

let createRefMaker = (sourceRepoPath) => {
    return RefMaker.create(sourceRepoPath, refStorePath, refName, false, storageType)
    .then(result => {
        refMaker = result;
    });
}

let resetRepo = (sourceRepoPath) => {
    return fs.remove(sourceRepoPath)
    .then(() => {
        return zip.extractArchiveTo(
            path.join(utils.ARCHIVE_RESOURCES_PATH, "compare-vcs.zip"),
            sourceRepoPath
        );
    });
}

let initializeRepo = (sourceRepoPath) => {
    return resetRepo(sourceRepoPath)
    .then(() => createRefMaker(sourceRepoPath));
}

let preStage = (sourceRepoPath, stageName) => {
    return resetRepo(sourceRepoPath);
}

let postStage = (sourceRepoPath, stageName) => {
    return refMaker.save(stageName);
}

require("../../dev/generate-base-repo").generateBaseRepo(
    workingPath,
    assetStorePath,
    path.join(resoruceBasePath, yamlSubPath),
    utils.ARCHIVE_RESOURCES_PATH
)
.then(() => {
    return zip.archivePathTo(
        path.join(refStorePath, refName),
        path.join(workingPath, refName) + '.zip',
        false
    );
});
