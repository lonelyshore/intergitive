"use strict";


const fs = require("fs-extra");
const path = require("path");

const resoruceBasePath = path.resolve("./test/resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-base-repo.yaml");

const workingPath = path.resolve("./test/playground/generate-vcs-repo");

const nodeConsole = require('console');
let myConsole = new nodeConsole.Console(process.stdout, process.stderr);
myConsole.log(workingPath);

let initializeRepo = (sourceRepoPath) => {
    return fs.emptyDir(sourceRepoPath);
}

let gen = require("./dev/generate-base-repo");

myConsole.log(gen)
// gen.generateBaseRepo(
//     workingPath,
//     assetStorePath,
//     path.join(resoruceBasePath, yamlSubPath),
//     initializeRepo
// );
