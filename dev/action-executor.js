"use strict";

const simpleGit = require("simple-git/promise");
const path = require('path');
const ActionExecutor = require("../lib/action-executor").ActionExecutor;

const getRepo = Symbol("getRepo");

/**
 * @inheritdoc
 */
class DevActionExecutor extends ActionExecutor {
    constructor(fileSystemBaseFolder, assetLoader, repoSetups) {
        super(fileSystemBaseFolder, assetLoader, repoSetups);
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
            console.error(`[executeGitCommand] error occured when executing ${command} with arguments [${commandArguments.join([","])}]\nerror: ` + err.message);
            throw err;
        });
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
}

module.exports.DevActionExecutor = DevActionExecutor;