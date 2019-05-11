"use strict";

const fs = require("./fs-extra-workaround");
const path = require("path");
const git = require("./git-kit");
const AssetLoader = require("./asset-loader").AssetLoader;
const RepoVcsSetup = require("./config-level").RepoVcsSetup;

const operateRepo = Symbol("operateRepo");

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

        return Promise.all(writes).catch(err => {
            console.error("[executeWriteFile] " + err.message);
            throw err;
        });
    }

    executeRemoveFile(targetPaths) {
        let removes = [];
        let errors = [];
        
        targetPaths.forEach(targetPath => {
            let fullPath = path.join(this.fileSystemBaseFolder, targetPath);

            removes.push(
                fs.access(fullPath)
                .then(() => {
                    return fs.remove(path.join(this.fileSystemBaseFolder, targetPath));
                })
                .catch(err => {
                    errors.push(err);
                })
            );
        });

        return Promise.all(removes).then(() => {
            if (errors.length !== 0)
            {
                console.error("[executeRemoveFile] " + errors[0].message);
                throw errors[0];
            }
        });
    }

    executeMoveFile(sourcePath, destinationPath) {
        return fs.move(
            path.join(this.fileSystemBaseFolder, sourcePath), 
            path.join(this.fileSystemBaseFolder, destinationPath)
        )
        .catch(err => {
            console.error("[executeMoveFile] " + err.message);
            throw err;
        })
    }

    executeStaging(repoSetupName, pathspecs) {
        return this[operateRepo](
            repoSetupName,
            repo => {
                return repo.refreshIndex()
                .then(index => {
                    return index.addAll(pathspecs)
                    .then(() => {
                        return index.write();
                    });
                })
                .then(() => {
                    return repo.refreshIndex();
                })
                .catch(err => {
                    console.error("[executeStaging] " + err.message);
                    throw err;
                });
            }
        );
    }

    [operateRepo](repoSetupName, operation) {
        let getRepo = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!("repo" in setup)) {
                    return git.Repository.open(setup.workingPath)
                    .then(repo => {
                        setup.repo = repo;
                        return repo;
                    });
                }
                else {
                    return Promise.resolve(setup.repo);
                }
            }
        };

        return getRepo()
        .then(repo => {
            return operation(repo)
            .then(results => {
                repo.cleanup();
                return results;
            });
        });
    }
}

module.exports.ActionExecutor = ActionExecutor;