"use strict";

const fs = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");

const ACTION_SCHEMAS = require("./config-schema").LEVEL_CONFIG_SCHEMA;
const ActionExecutor = require("./action-executor").DevActionExecutor;
const Action = require("../lib/config-action").Action;
const AssetLoader = require("../lib/asset-loader").AssetLoader;
const RepoSetup = require("../lib/config-level").RepoVcsSetup;
const RefMaker = require("../lib/repo-vcs").RepoReferenceMaker;

/**
 * 
 * @callback InitializeRepoCb
 * @param {string} sourceRepoPath the path to the generated repository
 * @returns {Promise<any>}
 */
/**
 * @param {string} workingPath the working directory
 * @param {string} assetStorePath the path to the asset store
 * @param {string} yamlPath the path to the yaml config file
 * @param {InitializeRepoCb} initializeRepo
 */
module.exports.generateBaseRepo = function (workingPath, assetStorePath, yamlPath, initializeRepo) {

    const sourceRepoPath = path.join(workingPath, "repo");
    const refStorePath = path.join(workingPath, "repo-store");
    const refName = "generated-ref-repo";

    const assetLoader = new AssetLoader(assetStorePath);
    assetLoader.setBundlePath();
    
    const repoSetups = {
        repo: new RepoSetup(
            sourceRepoPath,
            undefined,
            undefined
        )
    };
    
    const actionExecutor = new ActionExecutor(
        workingPath,
        assetLoader,
        repoSetups
    );
    
    let refMaker;
    
    Promise.resolve()
    .then(() => {
        return fs.emptyDir(workingPath)
        .then(() => {
            return fs.emptyDir(refStorePath);
        })
        .then(() => initializeRepo(sourceRepoPath));
    })
    .then(() => {
        return RefMaker.create(sourceRepoPath, refStorePath, refName)
        .then(result => {
            refMaker = result;
        });
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
    
            if (config.perStageReset) {
                executions = executions.then(() => initializeRepo(sourceRepoPath));
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
    
            executions = executions.then(() => {
                return refMaker.save(stage.name)
                .catch(err => {
                    console.error(`[save ${stage.name}] ${err.message}`);
                    throw err;
                });
            });
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
                    throw err;
                });
            });
        }
    })

    return executions;
}
