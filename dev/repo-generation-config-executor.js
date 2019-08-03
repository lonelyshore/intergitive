'use strict';

const fs = require('fs-extra');
const yaml = require('js-yaml');
const RepoVcsSetup = require('../lib/config-level').RepoVcsSetup;
const REPO_TYPE = require('../lib/config-level').REPO_TYPE;

module.exports.RepoGenerationConfigExecutor = class RepoGenerationConfigExecutor {

    constructor() {
        this.SCHEMA = require('./config-schema').LEVEL_CONFIG_SCHEMA;
        this.Action = require('../lib/config-action').Action;
    }

    /**
     * 
     * @param {Object} stage 
     * @param {ActionExecutor} actionExecutor 
     */
    executeStageActions(stage, actionExecutor) {
        let executions = Promise.resolve();
        stage.actions.forEach(action => {
            if (action instanceof this.Action) {
                executions = executions.then(() => {
                    return action.executeBy(actionExecutor)
                        .catch(err => {
                            console.error(`[execute ${action.klass}] ${err.message}`);
                            console.error(err.stack);
                            throw err;
                        });
                });
            }
        })

        return executions;
    }

    tryApplyReplay(executions, stage, stageMap, actionExecutor) {

        if (stage.replay) {
            stage.replay.forEach(replayName => {
                let replayedStage = stageMap[replayName];

                executions = executions.then(() => this.executeStageActions(replayedStage, actionExecutor))
                .catch(err => {
                    console.error(`error when replaying ${replayName} for stage ${stage.name}`);
                    throw err;
                });                    
            });
        }

        return executions;
    }

    executeStage(stageName, stageMap, actionExecutor) {

        if (!(stageName in stageMap)) {
            return Promise.reject(new Error(`Cannot find find stageName ${stageName}`));
        }

        let stage = stageMap[stageName];

        let executions = Promise.resolve();
        executions = this.tryApplyReplay(executions, stage, stageMap, actionExecutor);
        executions = executions.then(() => this.executeStageActions(stage, actionExecutor));
        return executions;
    }

    createRepoVcsSetupsFromConfig(config) {
        let repoSetups = config.repoSetups;

        let repoSetupsForActionExecutor = {};

        Object.keys(repoSetups).forEach(repoSetupName => {
            let setup = repoSetups[repoSetupName];
            repoSetupsForActionExecutor[repoSetupName] = new RepoVcsSetup(
                setup.workingPath,
                setup.referenceStoreName,
                undefined,
                setup.repoType === 'remote' ? REPO_TYPE.REMOTE : REPO_TYPE.LOCAL
            );
        });

        return repoSetupsForActionExecutor;
    }

    loadConfigSync(configPath) {
        let content = fs.readFileSync(configPath);
        return this.loadConfigFromContent(content);
    }

    loadConfig(configPath) {
        return fs.readFile(configPath)
        .then(content => {
            return this.loadConfigFromContent(content);
        })
    }

    loadConfigFromContent(content) {

        let config = yaml.safeLoad(content, { schema: this.SCHEMA });

        let stageMap = {};
        let stageNames = [];
        config.stages.forEach(stage => {
            stageNames.push(stage.name);
            stageMap[stage.name] = stage;
        })

        return {
            stageMap: stageMap,
            stageNames: stageNames,
            repoSetups: config.repoSetups,
            resourcesSubPath: config.resourcesSubPath
        };
    }

}
