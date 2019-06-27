'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

const paths = require('../paths');
const schema = require('./level-config-schema');
const AssetLoader = require('./asset-loader').AssetLoader;
const ActionExecutor = require('./action-executor').ActionExecutor;
const stepConfigs = require('./config-step');
const UserOperablePhase = stepConfigs.UserOperablePhase;

const assetLoader = new AssetLoader(paths.RESOURCES_PATH);
assetLoader.setBundlePath(...paths.BUNDLE_PATH);

function loadLevelSteps(config) {
    
    let renderStepsBuffer = [];
    let stepStatesBuffer = {};
    config.steps.forEach((step, index) => {
        if (step.componentType) {
            renderStepsBuffer.push(`${index}`);
        }

        if (step.isBlocking) {
            this.state.blockingSteps.push(index);
            if (index <= this.state.currentBlockingStep) {
                this.state.currentBlockingStep = index;
            }
        }

        let initialState = step.createInitialState();
        initialState.isBlocked = index > this.state.currentBlockingStep;

        stepStatesBuffer[index] = {
            step: step,
            state: initialState
        }
    });

    this.state.renderSteps = renderStepsBuffer;
    this.state.stepStates = stepStatesBuffer;
    this.state.stepsReady = true;
}

function initializeWorkingPath(workingFullPath) {
    return fs.emptyDir(workingFullPath);
}

function initializeCheckpointStore(storePath, checkpointStoreName) {
    return fs.emptyDir(path.join(storePath, checkpointStoreName));
}

function updateBlockingStates() {
    Object.keys(this.state.stepStates).forEach(stepKey => {
        let parsedIndex = parseInt(stepKey)
        this.state.stepStates[stepKey].state.isBlocked = parsedIndex > this.state.currentBlockingStep;
    });
}

let store = {
    state: {
        stepsReady: false,
        terms: {
            elaborate: '',
            illustrate: '',
            instruct: '',
            verifyInputPlaceholder: '',
            verifyInputSubmitText: ''
        },
        renderSteps: [],
        stepStates: {},
        blockingSteps: [],
        currentBlockingStep: Number.MAX_SAFE_INTEGER,
        actionExecutor: null,
    },
    loadTerms() {
        let loadPromises = [];
        Object.keys(this.state.terms).forEach(key => {
            loadPromises.push(
                assetLoader.loadInfileAsset(`render/${key}`)
                .then(term => {
                    this.state.terms[key] = term;
                })
            )
        })

        return Promise.all(loadPromises);
    },
    loadText(assetId) {
        return assetLoader.getFullAssetPath(assetId)
        .then(assetPath => {
            return fs.readFile(assetPath, "utf8");
        });
    },
    processAssetIdInText(text) {
        const matchAssetId = /\$?{{[\s\w\d:\/\-_\.]*}}/g;
        let replacementMap = {};

        return Promise.resolve()
        .then(() => {
            let setReplacementMap = [];
            let matches = text.match(matchAssetId);

            if (matches === null){
                return;
            }
            else {
                matches.forEach(matched => {
                    if (matched.startsWith('$')) {
                        let assetKey = matched.slice(3, matched.length - 2).trim();
                        setReplacementMap.push(
                            assetLoader.loadInfileAsset(assetKey)
                            .then(content => {
                                replacementMap[matched] = content;
                            })
                        )
                    }
                    else {
                        let assetKey = matched.slice(2, matched.length - 2).trim();
                        setReplacementMap.push(
                            assetLoader.loadInfileAsset(assetKey)
                            .then(content => {
                                replacementMap[matched] = path.join(paths.STATIC_PATH, path.dirname(assetKey), content); // dirname is the sub path of the asset
                            })
                        )
                    }
                })
    
                return Promise.all(setReplacementMap);
            }
        })
        .then(() => {
            return text.replace(matchAssetId, (matched) => {
                return replacementMap[matched];
            });
        })
        .then(replacedText => {
            return this.processMustacheEscapeInText(replacedText);
        });
    },
    processMustacheEscapeInText(text) {
        const matchEscapedMustache = /\\({)|\\(})/g;
        return text.replace(matchEscapedMustache, '$1$2')
    },
    loadLevel(levelName) {
        this.state.stepsReady = false;

        return assetLoader.getFullAssetPath(`levels/${levelName}`)
        .then(assetPath => {
            console.log(`loading ${levelName} text`);
            return fs.readFile(assetPath);
        })
        .then(text => {
            console.log(`loading ${levelName} json`);
            return yaml.safeLoad(text, { schema: schema.LEVEL_CONFIG_SCHEMA });
        })
        .then(config => {
            
            return Promise.resolve()
            .then(() => {
                console.log(`loading ${levelName} steps`);
                loadLevelSteps.call(this, config);
            })
            .then(() => {
                console.log(`loading ${levelName} repo setups`);

                let initializeRepos = [];
                let repoVcsSetups = config.repoVcsSetups;
                
                if (repoVcsSetups) {
                    Object.keys(repoVcsSetups).forEach(repoVcsSetupName => {
                        let repoVcsSetup = repoVcsSetups[repoVcsSetupName];

                        if (repoVcsSetup.workingPath) {
                            initializeRepos.push(
                                initializeWorkingPath(
                                    path.join(paths.PLAYGROUND_PATH, repoVcsSetup.workingPath)
                                )
                            );
                        }

                        if (repoVcsSetup.checkpointStoreName) {
                            initializeRepos.push(
                                initializeCheckpointStore(
                                    paths.CHECKPOINT_STORE_PATH,
                                    repoVcsSetup.checkpointStoreName
                                )
                            );
                        }
                    });
                }

                return Promise.all(initializeRepos)
                .then(() => {
                    this.state.actionExecutor = 
                        new ActionExecutor(
                            paths.PLAYGROUND_PATH,
                            assetLoader,
                            repoVcsSetups
                        );
                });
            });
        })
    },
    verifyInputAnswer(stepKey, input) {
        let stepState = this.state.stepStates[stepKey];

        assert(stepState.step instanceof stepConfigs.VerifyInputStep, `VerifyInputAnswer is expected to be invoked by a VerifyInputStep, but is actually invoked by ${stepState.step} at index ${stepKey} `);

        let processedAnswer;
        return Promise.resolve()
        .then(() => {
            stepState.state.phase.current = UserOperablePhase.RUNNING;
            return new Promise(resolve => {
                setTimeout(resolve, 500);
            })
            .then(() => {
                return this.processAssetIdInText(stepState.step.answer)
                .then(processed => {
                    processedAnswer = processed;
                })
            });
        })
        .then(() => {
            if (input === processedAnswer) {
                this.unblock(parseInt(stepKey));
                stepState.state.phase.current = UserOperablePhase.SUCCESS;
            }
            else {
                stepState.state.phase.current = UserOperablePhase.FAILED;
            }
        });
    },
    unblock(unblockedIndex) {
        assert(unblockedIndex <= this.state.currentBlockingStep, `Expect unblocked index ${unblockedIndex} should be smaller than or equal to currently blocking index ${this.state.currentBlockingStep}`);
        let blockingStepArrayIndex = this.state.blockingSteps.indexOf(unblockedIndex);
        if (blockingStepArrayIndex != this.state.blockingSteps.length - 1) {
            this.state.currentBlockingStep = this.state.blockingSteps[blockingStepArrayIndex + 1];
        }
        else {
            this.state.currentBlockingStep = Number.MAX_SAFE_INTEGER;
        }

        updateBlockingStates.call(this);
    }
}

exports = module.exports = store;