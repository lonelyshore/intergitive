"use strict";

const fs = require("fs-extra");
const path = require("path");
const zip = require('../../lib/simple-archive');
const RefMaker = require('../../lib/repo-vcs').RepoReferenceMaker;
const devParams = require('../../dev/parameters');

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-base-repo.yaml");


const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const refStorePath = path.join(workingPath, "repo-store");
const refName = 'compare-vcs-grow-local-ref';

let createdRepoPath;
let refMaker;

let createRefMaker = (sourceRepoPath) => {
    createdRepoPath = sourceRepoPath;

    return RefMaker.create(sourceRepoPath, refStorePath, refName, devParams.defaultRepoStorageType)
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
    {
        initializeRepo: initializeRepo,
        postStage: postStage,
    }
)
.then(() => {
    return zip.archivePathTo(
        path.join(refStorePath, refName),
        path.join(workingPath, refName) + '.zip'
    );
})
.then(() => {
    return zip.archivePathTo(
        createdRepoPath,
        path.join(workingPath, 'compare-vcs') + '.zip'
    )
});
