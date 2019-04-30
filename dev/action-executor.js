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

    executeMerge(repoSetupName, toBranch, fromBranch) {
        return this[getRepo](repoSetupName)
        .then(repo => {
            return repo.mergeFromTo(fromBranch, toBranch);
        });
    }

    [getRepo](repoSetupName) {
        let setup = this.repoSetups[repoSetupName];
        if (!setup) {
            return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`));
        }
        else {
            if (!("devRepo" in setup)) {
                setup.devRepo = simpleGit(setup.workingPath);
            }

            return Promise.resolve(setup.devRepo);
        }
    }
}

module.exports.DevActionExecutor = DevActionExecutor;