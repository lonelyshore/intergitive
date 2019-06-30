"use strict";

const fs = require("fs-extra");
const path = require("path");
const zip = require("../../lib/simple-archive");
const RefMaker = require('../../lib/repo-vcs').RepoReferenceMaker;

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-testing-ref-repo.yaml");

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");

let refMaker;

let createRefMaker = (sourceRepoPath) => {
    const refStorePath = path.join(workingPath, "repo-store");
    const refName = 'generate-ref-repo';

    return RefMaker.create(sourceRepoPath, refStorePath, refName)
    .then(result => {
        refMaker = result;
    });
}

let resetRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath)
    .then(() => {
        return zip.extractArchiveTo(path.join(resoruceBasePath, "repo-archive", "compare-vcs.zip"), path.dirname(sourceRepoPath));
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

let initializeRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath)

}

require("../../dev/generate-base-repo").generateBaseRepo(
    workingPath,
    assetStorePath,
    path.join(resoruceBasePath, yamlSubPath),
    {
        initializeRepo: initializeRepo,
        preStage: preStage,
        postStage: postStage
    }
);
