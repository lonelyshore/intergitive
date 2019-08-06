'use strict';

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const zip = require('../lib/simple-archive');
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

    initializeRepos(workingPath, archiveStorePath, config, onRepoInitialized) {
        let initializations = Promise.resolve();

        let repoSetups = config.repoSetups;
        Object.keys(repoSetups).forEach(repoSetupName => {

            let repoSetup = repoSetups[repoSetupName];

            let fullWorkingPath = path.join(
                workingPath,
                repoSetup.workingPath
            );

            initializations = initializations.then(() => {
                return fs.emptyDir(fullWorkingPath);
            });

            if (repoSetup.repoArchiveName) {

                initializations = initializations.then(() => {
                    return zip.extractArchiveTo(
                        path.join(archiveStorePath, repoSetup.repoArchiveName),
                        fullWorkingPath
                    )
                });

            }

            if (onRepoInitialized) {
                initializations = initializations.then(() => {
                    return onRepoInitialized(
                        repoSetupName,
                        fullWorkingPath
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
