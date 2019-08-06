"use strict";

const simpleGit = require("simple-git/promise");
const path = require('path');
const vcs = require('../lib/repo-vcs');
const ActionExecutor = require("../lib/action-executor").ActionExecutor;
const REPO_TYPE = require('../lib/config-level').REPO_TYPE;

const getRepo = Symbol("getRepo");

/**
 * @inheritdoc
 */
class DevActionExecutor extends ActionExecutor {
    constructor(fileSystemBaseFolder, repoStoreSubPath, assetLoader, repoSetups, repoStorageType) {
        super(fileSystemBaseFolder, repoStoreSubPath, assetLoader, repoSetups, repoStorageType);
    }

    executeStaging(repoSetupName, pathSpecs) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            
            return repo.add(pathSpecs)
            .catch(err => {
                if (!err.toString().includes("fatal: pathspec")) {
                    throw err;
                }
            });
        })
        .catch(err => {
            console.error("[executeStaging] " + err.message);
            throw err;
        });
    }

    executeMerge(repoSetupName, withBranch) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            return repo.merge([withBranch])
            .catch(err => {
                if (!(err.toString().includes("CONFLICTS:"))) {
                    throw err;
                }
            });
        })
        .catch(err => {
            console.error("[executeMerge] " + err.message);
            throw err;
        });;
    }

    executeContinueMerge(repoSetupName) {
        return this[getRepo](repoSetupName) 
        .then(repo => {
            return repo.env("GIT_EDITOR", "true") // skip editor so the script can continue execution without user interaction
            .merge(["--continue"]);
        })
        .catch(err => {
            console.error("[executeContinueMerge] " + err.message);
            throw err;
        });;
    }

    executeCleanCheckout(repoSetupName, revSpec) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            return repo.checkout(["-f", revSpec])
            .then(() => {
                return repo.clean("f", ["-d"]);
            })
        })
        .catch(err => {
            console.error("[executeCleanCheckout] " + err.message);
            throw err;
        });
    }

    executeGitCommand(repoSetupName, commandArguments) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            return repo.raw(commandArguments);
        })
        .catch(err => {
            console.error(`[executeGitCommand] error occured when executing git command [${commandArguments.join([","])}]\nerror: ` + err.message);
            throw err;
        });
    }

    executeSaveReference(repoSetupName, referenceName) {
        return this.operateReferenceMaker(
            repoSetupName,
            (refMaker) => {
                return refMaker.save(referenceName);
            }
        );
    }

    getRepoSetupNames() {
        return Object.keys(this.repoSetups);
    }

    getRepoFullPaths(repoSetupName) {
        let setup = this.repoSetups[repoSetupName];
        let result = {};
        if (setup) {
            if (setup.workingPath) {
                result.fullWorkingPath =
                    path.join(
                        this.fileSystemBaseFolder,
                        setup.workingPath
                    );
            }
            if (this.repoStoreSubPath) {
                if (setup.referenceStoreName) {
                    result.fullReferenceStorePath =
                        path.join(
                            this.fileSystemBaseFolder,
                            this.repoStoreSubPath,
                            setup.referenceStoreName
                        );
                }
                if (setup.checkpointStoreName) {
                    result.fullCheckpointStorePath =
                        path.join(
                            this.fileSystemBaseFolder,
                            this.repoStoreSubPath,
                            setup.checkpointStoreName
                        );
                }
            }
        }

        return result;
    }

    [getRepo](repoSetupName) {
        let setup = this.repoSetups[repoSetupName];
        if (!setup) {
            return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
        }
        else {
            if (!("devRepo" in setup)) {
                setup.devRepo = simpleGit(path.join(this.fileSystemBaseFolder, setup.workingPath));
                setup.devRepo.silent(true);
            }

            return Promise.resolve(setup.devRepo);
        }
    }

    operateReferenceMaker(repoSetupName, operation) {
        let getReferenceMaker = () => {
            let setup = this.repoSetups[repoSetupName];
            if (!setup) {
                return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
            }
            else {
                if (!('referenceMaker' in setup)) {
                    return vcs.RepoReferenceMaker.create(
                        path.join(this.fileSystemBaseFolder, setup.workingPath),
                        path.join(this.fileSystemBaseFolder, this.repoStoreSubPath),
                        setup.referenceStoreName,
                        setup.repoType === REPO_TYPE.REMOTE,
                        this.repoStorageType
                    )
                    .then(result => {
                        setup.referenceMaker = result;
                        return result;
                    });
                }
                else {
                    return Promise.resolve(setup.referenceMaker)
                }
            }
        }

        return getReferenceMaker()
        .then(referenceMaker => {
            return operation(referenceMaker);
        });
    }
}

module.exports.DevActionExecutor = DevActionExecutor;