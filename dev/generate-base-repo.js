"use strict";

const fs = require("fs-extra");
const path = require("path");
const zip = require('../lib/simple-archive');

const ActionExecutor = require("./action-executor").DevActionExecutor;
const actionConfigs = require("../dev/config-action");
const AssetLoader = require("../lib/asset-loader").AssetLoader;
const REPO_STORAGE_TYPE = require('../lib/repo-vcs').STORAGE_TYPE;

let SAVE_TYPE = {
    ARCHIVE: REPO_STORAGE_TYPE.ARCHIVE,
    GIT: REPO_STORAGE_TYPE.GIT,
    SNAPSHOT: Symbol('snapshot')
};


const configExecutor = 
    new (require('./repo-generation-config-executor')
    .RepoGenerationConfigExecutor)();

/**
 * 
 * @callback InitializeRepoCb
 * @param {string} repoName
 * @param {string} sourceRepoPath the path to the generated repository
 * @returns {Promise<any>}
 */

/**
 * 
 * @callback StageCb
 * @param {string} repoName
 * @param {string} sourceRepoPath
 * @param {string} stageName
 * @returns {Promise<any>}
 */

 /**
  * @typedef Options
  * @type {Object}
  * @property {InitializeRepoCb} onRepoInitialized
  * @property {StageCb} preStage
  * @property {StageCb} postStage
  * @property {SAVE_TYPE} saveType
  */

module.exports.SAVE_TYPE = SAVE_TYPE;

/**
 * @param {string} workingPath the working directory
 * @param {string} assetStorePath the path to the asset store
 * @param {string} yamlPath the path to the yaml config file
 * @param {string} archiveStorePath
 * @param {Options} options
 */
module.exports.generateBaseRepo = function (workingPath, assetStorePath, yamlPath, archiveStorePath, options) {

    options = options || {};

    const repoStoreName = 'repo-stores';

    const assetLoader = new AssetLoader(assetStorePath);
    assetLoader.setBundlePath();
    
    let actionExecutor;
    let repoSetups;
    
    return configExecutor.loadConfig(yamlPath)
    .then(config => {

        repoSetups = config.repoSetups;


        return Promise.resolve()
        .then(() => {
            let repoSetupsForActionExecutor = 
                configExecutor.createRepoVcsSetupsFromConfig(
                    config
                );

            actionExecutor = new ActionExecutor(
                workingPath,
                repoStoreName,
                assetLoader,
                repoSetupsForActionExecutor,
                options.saveType !== SAVE_TYPE.SNAPSHOT ? options.saveType : undefined
            );

            Object.keys(repoSetups).forEach(repoSetupName => {
                let repoSetup = repoSetups[repoSetupName];

                repoSetup = Object.assign(
                    repoSetup,
                    actionExecutor.getRepoFullPaths(repoSetupName)
                );
            });
        })
        .then(() => {
            return fs.emptyDir(workingPath)
            .then(() => {
                return initializeRepos(
                    workingPath,
                    archiveStorePath,
                    repoSetups,
                    options.onRepoInitialized
                );
            });
        })
        .then(() => {
            let executions = Promise.resolve();
    
            config.stageNames.forEach(stageName => {
    
                let stage = config.stageMap[stageName];
    
                if (stage.reset) {
                    executions = executions.then(() => {
                        return initializeRepos(
                            workingPath,
                            archiveStorePath,
                            repoSetups
                        );
                    });
                }

                if (options.preStage) {
                    executions = executions.then(() => {
                        return invokeStageCalbacks(
                            options.preStage,
                            workingPath,
                            stageName,
                            repoSetups
                        );
                    })
                    .catch(err => {
                        console.error(`[Pre-${stageName}] occured error`);
                        console.error(err);
                        throw err;
                    });
                }
        
                executions = 
                    executions.then(() => {
                        return configExecutor
                        .executeStage(stageName, config.stageMap, actionExecutor)
                        .catch(err => {
                            console.error(`[Execute Stage ${stageName}] error occured`);
                            console.error(err);
                            throw err;
                        });
                    });

                if (stage.save) {
                    stage.save.forEach(savedRepoName => {
                        if (options.saveType === SAVE_TYPE.SNAPSHOT) {
                            
                            executions = executions.then(() => {
                                return zip.archivePathTo(
                                    repoSetups[savedRepoName].fullWorkingPath,
                                    path.join(
                                        repoSetups[savedRepoName].fullReferenceStorePath,
                                        `${stageName}.zip`,
                                    ),
                                    false
                                );
                            });
                        }
                        else {
                            let saveAction = new actionConfigs.SaveRepoReferenceAction(
                                savedRepoName,
                                stageName
                            );

                            executions = executions.then(() => {
                                return saveAction.executeBy(actionExecutor);
                            });
                        }

                        executions = executions.catch(err => {
                            console.error(`[Save Stage ${stageName}] error occured`);
                            console.error(err);
                            throw err;
                        })
                    });
                }
        
                if (options.postStage) {
                    executions = executions.then(() => {
                        return invokeStageCalbacks(
                            options.postStage,
                            workingPath,
                            stageName,
                            repoSetups
                        );
                    })
                    .catch(err => {
                        console.error(`[Post-${stageName}] occured error`);
                        console.error(err);
                        throw err;
                    });
                }
            })
        
            return executions;
        })
    })
    .then(() => {
        return repoSetups;
    })

    /**
     * 
     * @param {string} workingPath 
     * @param {string} archiveStorePath 
     * @param {Object} repoSetups 
     * @param {InitializeRepoCb} onRepoInitialized 
     */
    function initializeRepos(workingPath, archiveStorePath, repoSetups, onRepoInitialized) {
        let initializations = Promise.resolve();
        Object.keys(repoSetups).forEach(repoSetupName => {

            let repoSetup = repoSetups[repoSetupName];

            initializations = initializations.then(() => {
                return fs.emptyDir(repoSetup.fullWorkingPath);
            })

            if (repoSetup.repoArchiveName) {

                initializations = initializations.then(() => {
                    return zip.extractArchiveTo(
                        path.join(archiveStorePath, repoSetup.repoArchiveName),
                        repoSetup.fullWorkingPath
                    )
                });

            }

            if (onRepoInitialized) {
                initializations = initializations.then(() => {
                    return onRepoInitialized(
                        repoSetupName,
                        repoSetup.fullWorkingPath
                    );
                })
                .catch(err => {
                    console.error(`[InitializationCallback] error occured for ${repoSetupName}`);
                    console.error(err);
                    throw err;
                });
            }

        });

        return initializations;
    }

    /**
     * 
     * @param {StageCb} callback 
     * @param {string} workingPath 
     * @param {string} stageName
     * @param {Object} repoSetups 
     */
    function invokeStageCalbacks(callback, workingPath, stageName, repoSetups) {
        let invocations = Promise.resolve();
        Object.keys(repoSetups).forEach(repoSetupName => {
            let repoSetup = repoSetups[repoSetupName];

            invocations = invocations.then(() => {
                return callback(
                    repoSetupName,
                    repoSetup.fullWorkingPath,
                    stageName
                );
            })
            .catch(err => {
                console.error(`[InvokeStageCallback] error for repoName: ${repoSetupName}`);
                throw err;
            });
        });

        return invocations;
    }
}
