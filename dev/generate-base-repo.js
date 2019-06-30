"use strict";

const fs = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");

const ACTION_SCHEMAS = require("./config-schema").LEVEL_CONFIG_SCHEMA;
const ActionExecutor = require("./action-executor").DevActionExecutor;
const Action = require("../lib/config-action").Action;
const AssetLoader = require("../lib/asset-loader").AssetLoader;
const RepoSetup = require("../lib/config-level").RepoVcsSetup;

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
        assetLoader,
        repoSetups
    );
    
    Promise.resolve()
    .then(() => {
        return fs.emptyDir(workingPath)
        .then(() => options.initializeRepo(sourceRepoPath));
    })
    .then(() => {
        return fs.readFile(yamlPath)
        .then(content => {
            return yaml.load(content, { schema: ACTION_SCHEMAS });
        });
    })
    .then(config => {
        let stageMap = {};
        config.stages.forEach(stage => {
            stageMap[stage.name] = stage.contents;
        });
    
        let executions = Promise.resolve();
    
        config.stages.forEach(stage => {
    
            if (options.preStage) {
                executions = executions.then(() => options.preStage(sourceRepoPath, stage.name))
                .catch(err => {
                    console.error(`[Pre-${stage.name}] ${err.message}`);
                    console.error(err.stack);
                    throw err;                    
                });
            }
    
            let contents = stage.contents;
            if (contents.length !== 0 && ("replay" in contents[0])) {
                let replayContents = [];
                contents[0]["replay"].forEach(replayName => {
                    replayContents = replayContents.concat(stageMap[replayName]);
                });
    
                executions = executions.then(() => executeContents(replayContents, actionExecutor))
                .catch(err => {
                    console.error(`error when replaying ${stage.name}`);
                    throw err;
                });
            }
    
            executions = executions.then(() => executeContents(contents, actionExecutor))
            .catch(err => {
                console.error(`error when executing contents of ${stage.name}`)
                throw err;
            });;
    
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

/**
 * 
 * @param {Array<Any>} contents 
 * @param {ActionExecutor} actionExecutor 
 */
function executeContents(contents, actionExecutor) {
    let executions = Promise.resolve();
    contents.forEach(item => {
        if (item instanceof Action) {
            executions = executions.then(() => {
                return item.executeBy(actionExecutor)
                .catch(err => {
                    console.error(`[execute ${item.klass}] ${err.message}`);
                    console.error(err.stack);
                    throw err;
                });
            });
        }
    })

    return executions;
}
