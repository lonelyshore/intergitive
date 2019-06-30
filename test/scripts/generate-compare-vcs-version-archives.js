"use strict";

const fs = require("fs-extra");
const path = require("path");
const zip = require("../../lib/simple-archive");

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-testing-ref-repo.yaml");

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const archivePath = path.join(workingPath, "compare-vcs-version-archives");


let resetRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath)
    .then(() => {
        return zip.extractArchiveTo(path.join(resoruceBasePath, "repo-archive", "compare-vcs.zip"), path.dirname(sourceRepoPath));
    });
}

let initializeRepo = (sourceRepoPath) => {
    return resetRepo(sourceRepoPath)
    .then(() => {
        return fs.emptyDir(archivePath);
    });
}

let postStage = (sourceRepoPath, stageName) => {
    return zip.archivePathTo(
        sourceRepoPath,
        path.join(archivePath, stageName) + '.zip'
    );
}

require("../../dev/generate-base-repo").generateBaseRepo(
    workingPath,
    assetStorePath,
    path.join(resoruceBasePath, yamlSubPath),
    {
        initializeRepo: initializeRepo,
        postStage: postStage
    }
)
.then(() => {
    return zip.archivePathTo(
        archivePath,
        path.join(archivePath) + '.zip'
    );
});
