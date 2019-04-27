"use strict";

const fs = require("fs-extra");
const path = require("path");
const git = require("./git-kit");
const AssetLoader = require("./asset-loader").AssetLoader;
const RepoVcsSetup = require("./config-level").RepoVcsSetup;


class ActionExecutor {
    /**
     * 
     * @param {string} fileSystemBaseFolder 
     * @param {AssetLoader} assetLoader
     * @param {Object} repoSetups
     */
    constructor(fileSystemBaseFolder, assetLoader, repoSetups) {
        this.fileSystemBaseFolder = fileSystemBaseFolder;
        this.assetLoader = assetLoader;
        this.repoSetups = Object.assign({}, repoSetups);
    }

    /**
     * 
     * @param {Array<string>} sourceKeyIds 
     * @param {Array<string>} destinationPaths 
     */
    executeWriteFile(sourceKeyIds, destinationPaths) {
        
        if (sourceKeyIds.length !== destinationPaths.length) {
            return new Promise.reject(
                new Error(
                    `sourceKeyIds should have a length (${sourceKeyIds.length}) equals to the one of destinationPaths (${destinationPaths.length})`));
        }

        let writes = [];
        
        sourceKeyIds.forEach((keyId, index) => {
            writes.push(
                this.assetLoader.getFullAssetPath(keyId)
                .then(sourcePath => {
                    return fs.copy(sourcePath, path.join(this.fileSystemBaseFolder, destinationPaths[index]));
                })
            );
        });

        return Promise.all(writes);
    }

    executeStaging(repoSetupName, pathspecs) {
        let getRepo = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!("repo" in setup)) {
                    return git.Repository.open(setup.workingPath);
                }
                else {
                    return Promise.resolve(setup.repo);
                }
            }
        };

        return getRepo()
        .then(repo => {
            return repo.index();
        })
        .then(index => {
            return index.addAll(pathspecs);
        });
    }
}

module.exports.ActionExecutor = ActionExecutor;