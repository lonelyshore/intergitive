"use strict";

const simpleGit = require("simple-git/promise");
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
        });
    }

    executeContinueMerge(repoSetupName) {
        return this[getRepo](repoSetupName) 
        .then(repo => {
            return repo.env("GIT_EDITOR", "true") // skip editor so the script can continue execution without user interaction
            .merge(["--continue"]);
        });
    }

    executeCleanCheckout(repoSetupName, revSpec) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            return repo.checkout(["-f", revSpec])
            .then(() => {
                return repo.clean("f", ["-d"]);
            })
        })
    }

    [getRepo](repoSetupName) {
        let setup = this.repoSetups[repoSetupName];
        if (!setup) {
            return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
        }
        else {
            if (!("devRepo" in setup)) {
                setup.devRepo = simpleGit(setup.workingPath);
                setup.devRepo.silent(true);
            }

            return Promise.resolve(setup.devRepo);
        }
    }
}

module.exports.DevActionExecutor = DevActionExecutor;