"use strict";

const fs = require("fs-extra");
const path = require("path");
const zip = require('../../lib/simple-archive');
const utils = require('../tests/test-utils');
const STORAGE_TYPE = require('../../lib/repo-vcs').STORAGE_TYPE;
const RefMaker = require('../../lib/repo-vcs').RepoReferenceMaker;

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-base-repo.yaml");

const storageType = STORAGE_TYPE.ARCHIVE;

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const refStorePath = path.join(workingPath, "repo-store");
const refName = `compare-vcs-grow-local-ref-${storageType.toLowerCase()}`;

let createdRepoPath;
let refMaker;

let createRefMaker = (sourceRepoPath) => {
    createdRepoPath = sourceRepoPath;

    return RefMaker.create(sourceRepoPath, refStorePath, refName, false, storageType)
    .then(result => {
        refMaker = result;
    });
}

let resetRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath);
}

let initializeRepo = (sourceRepoPath) => {
    return resetRepo(sourceRepoPath)
    .then(() => createRefMaker(sourceRepoPath));
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
})
.then(() => {
    return zip.archivePathTo(
        createdRepoPath,
        path.join(workingPath, 'compare-vcs') + '.zip',
        false
    )
});
