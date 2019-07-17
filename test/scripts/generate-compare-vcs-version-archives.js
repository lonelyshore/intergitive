"use strict";

const fs = require("fs-extra");
const path = require("path");
const simpleGit = require('simple-git/promise');
const utils = require('../tests/test-utils');
const zip = require("../../lib/simple-archive");

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate-testing-ref-repo.yaml");

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const archivePath = path.join(workingPath, "compare-vcs-version-archives");


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
    .then(() => {
        return fs.emptyDir(archivePath);
    });
}

let preStage = (sourceRepoPath, stageName) => {
    return resetRepo(sourceRepoPath);
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
        preStage: preStage,
        postStage: postStage
    }
)
.then(() => {
    let initRepoPath = path.join(archivePath, 'init');
    return fs.mkdirp(initRepoPath)
    .then(() => {
        return simpleGit(initRepoPath)
    })
    .then(repo => {
        return repo.raw(['init'])
        .then(() => {
            return repo.raw(['config', '--local', 'user.name', 'test-repo']);
        })
        .then(() => {
            return repo.raw(['config', '--local', 'user.email', 'test-repo@some.mail.server']);
        })
        .then(() => {
            return repo.raw(['config', '--local', 'core.autocrlf', 'input']);
        });
    })
    .then(() => {
        return zip.archivePathTo(
            initRepoPath,
            initRepoPath + '.zip'
        );
    })
    .then(() => {
        return fs.remove(initRepoPath);
    });
})
.then(() => {
    return zip.archivePathTo(
        archivePath,
        archivePath + '.zip'
    );
});
