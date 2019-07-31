"use strict";

const fs = require("fs-extra");
const path = require("path");

const ActionExecutor = require("./action-executor").DevActionExecutor;
const Action = require("../lib/config-action").Action;
const AssetLoader = require("../lib/asset-loader").AssetLoader;
const RepoSetup = require("../lib/config-level").RepoVcsSetup;

const configExecutor = 
    new (require('./repo-generation-config-executor')
    .RepoGenerationConfigExecutor)();

/**
 * 
 * @callback InitializeRepoCb
 * @param {string} sourceRepoPath the path to the generated repository
 * @returns {Promise<any>}
 */

/**
 * 
 * @callback PreStageCb
 * @param {string} sourceRepoPath
 * @param {string} stageName
 * @returns {Promise<any>}
 */

 /**
  * @callback PostStageCb
  * @param {string} sourceRepoPath
  * @param {string} stageName
  * @returns {Promise<any>}
  */

 /**
  * @typedef Options
  * @type {Object}
  * @property {InitializeRepoCb} initializeRepo
  * @property {PreStageCb} preStage
  * @property {PostStageCb} postStage
  */

/**
 * @param {string} workingPath the working directory
 * @param {string} assetStorePath the path to the asset store
 * @param {string} yamlPath the path to the yaml config file
 * @param {Options} options
 */
module.exports.generateBaseRepo = function (workingPath, assetStorePath, yamlPath, options) {

    const sourceRepoPath = path.join(workingPath, "repo");

    const assetLoader = new AssetLoader(assetStorePath);
    assetLoader.setBundlePath();
    
    const repoSetups = {
        repo: new RepoSetup(
            path.relative(workingPath, sourceRepoPath),
            undefined,
            undefined
        )
    };
    
    const actionExecutor = new ActionExecutor(
        workingPath,
        undefined,
        assetLoader,
        repoSetups
    );
    
    return Promise.resolve()
    .then(() => {
        return fs.emptyDir(workingPath)
        .then(() => options.initializeRepo(sourceRepoPath));
    })
    .then(() => {
        return configExecutor.loadConfig(yamlPath);
    })
    .then(config => {
    
        let executions = Promise.resolve();
    
        config.stageNames.forEach(stageName => {

            let stage = config.stageMap[stageName];
    
            if (options.preStage) {
                executions = executions.then(() => options.preStage(sourceRepoPath, stage.name))
                .catch(err => {
                    console.error(`[Pre-${stage.name}] ${err.message}`);
                    console.error(err.stack);
                    throw err;                    
                });
            }

            if (stage.reset) {
                executions = executions.then(() => options.initializeRepo(sourceRepoPath));
            }
    
            executions = configExecutor.executeStage(stageName, config.stageMap, actionExecutor);
    
            if (options.postStage) {
                executions = executions.then(() => {
                    return options.postStage(sourceRepoPath, stage.name)
                    .catch(err => {
                        console.error(`[Post-${stage.name}] ${err.message}`);
                        throw err;
                    });
                });
            }
        })
    
        return executions;
    });
    
}
