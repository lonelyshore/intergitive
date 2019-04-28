"use strict";

const simpleGit = require("simple-git/promise");
const ActionExecutor = require("../lib/action-executor").ActionExecutor;

/**
 * @inheritdoc
 */
class DevActionExecutor extends ActionExecutor {
    constructor(fileSystemBaseFolder, assetLoader, repoSetups) {
        super(fileSystemBaseFolder, assetLoader, repoSetups);
    }

    executeStaging(repoSetupName, pathSpecs) {
        let getRepo = () => {
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
        };

        return getRepo()
        .then(repo => {
            return repo.add(pathSpecs)
            .catch(err => {
                if (!err.toString().includes("fatal: pathspec")) {
                    throw err;
                }
            });
        })
    }
}

module.exports.DevActionExecutor = DevActionExecutor;