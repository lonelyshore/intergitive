"use strict";

const fs = require("fs-extra");
const path = require("path");

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-base-repo.yaml");

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");

let initializeRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath);
}

require("../../dev/generate-base-repo").generateBaseRepo(
    workingPath,
    assetStorePath,
    path.join(resoruceBasePath, yamlSubPath),
    initializeRepo
);
