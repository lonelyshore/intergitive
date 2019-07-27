'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

const paths = require('../paths');
const zip = require('../lib/simple-archive');
const schema = require('./level-config-schema');
const AssetLoader = require('./asset-loader').AssetLoader;
const ActionExecutor = require('./action-executor').ActionExecutor;
const stepConfigs = require('./config-step');
const actionConfigs = require('./config-action');

const assetLoader = new AssetLoader(paths.RESOURCES_PATH);
assetLoader.setBundlePath(...paths.BUNDLE_PATH);

function loadLevelSteps(config) {

    let renderStepsBuffer = [];
    let stepStatesBuffer = {};
    config.steps.forEach((step, index) => {
        
        let indexString = `${index}`;

        if (step.componentType) {
            renderStepsBuffer.push(indexString);
        }

        if (step.isBlocking) {
            this.state.blockingSteps.push(index);
        }

        if (step.needProcess) {
            this.state.needProcessSteps.push(index);
        }

        let initialState = step.createInitialState();

        stepStatesBuffer[indexString] = {
            step: step,
            state: initialState,
            deepCloneInto: step.deepCloneInto
        }
    });

    this.state.renderSteps = renderStepsBuffer;
    this.state.stepStates = stepStatesBuffer;
    this.state.stepsReady = true;

    // Process blocking issue
    this.state.currentBlockingStep = 
        this.state.blockingSteps.length !== 0
        ? this.state.blockingSteps[0]
        : config.length;

    this.state.minProcessingStep = 0;

    this.updateBlockingStates();
}


function initializeWorkingPath(workingFullPath) {
    return fs.emptyDir(workingFullPath)
    .catch(err => {
        console.error(`Failed to initialize working path:\n${err}`);
    });
}

function initializeCheckpointStore(storePath, checkpointStoreName) {
    return fs.emptyDir(path.join(storePath, checkpointStoreName))
    .catch(err => {
        console.error(`Failed to initialize checkpoint store ${checkpointStoreName}:\n${err}`)
    });
}

function initializeRepoStore(storePath, refStoreName, assetLoader) {
    let refStorePath = path.join(storePath, refStoreName);
    return fs.emptyDir(refStorePath)
    .then(() => {
        return assetLoader.getFullAssetPath(`archives/${refStoreName}`)
    })
    .then(archivePath => {
        return zip.extractArchiveTo(
            archivePath,
            refStorePath
        )
    })
    .catch(err => {
        console.error(`Failed to initialize repo ref store ${refStoreName}:\n${err}`);
    });
}

class StoreStateCheckpoint {
    constructor(state) {
        this.clonedStepStates = {};

        Object.keys(state.stepStates).forEach(key => {
            let clonedStepState = {};
            let stepState = state.stepStates[key];

            stepState.deepCloneInto(stepState.state, clonedStepState);
            this.clonedStepStates[key] = clonedStepState;
        });

        this.currentBlockingStep = state.currentBlockingStep;
        this.minProcessingStep = state.minProcessingStep;
    }

    applyTo(state) {
        Object.keys(this.clonedStepStates).forEach(key => {
            let clonedStepState = this.clonedStepStates[key];
            let stepState = state.stepStates[key];

            stepState.deepCloneInto(clonedStepState, stepState.state);
        });

        state.currentBlockingStep = this.currentBlockingStep;
        state.minProcessingStep = this.minProcessingStep;
    }
}

let store = {
    state: {
        isDebug: true,
        stepsReady: false,
        levelName: '',
        terms: {
            elaborate: '',
            illustrate: '',
            instruct: '',
            verifyInputPlaceholder: '',
            verifyInputSubmitText: '',
            verifyRepoDescription: '',
            checkpointReadyToSave: '',
            checkpointSaving: '',
            checkpointLoading: '',
            checkpointReadyToLoad: '',
            startOperationButton: '',
            operationReady: '',
            operationRunning: '',
            operationFailed: '',
            operationCompleted: '',
            checkpointSaveButton: '',
            checkpointLoadButton: ''
        },
        commonAssetRelativePaths: {
            img_correct: '',
        },
        renderSteps: [],
        stepStates: {},
        blockingSteps: [],
        needProcessSteps: [],
        currentBlockingStep: Number.MAX_SAFE_INTEGER,
        minProcessingStep: Number.MAX_SAFE_INTEGER,
        actionExecutor: null,
        checkpoints: {},
    },
    loadTerms() {
        let loadPromises = [];

        Object.values(stepConfigs.AUTO_PLAY_DESCRIPTION_IDS)
        .forEach(autoplayDescriptionId => {
            this.state.terms[autoplayDescriptionId] = '';
        });

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
    loadCommonAssetRelativePaths() {
        let loadPromises = [];

        Object.keys(this.state.commonAssetRelativePaths).forEach(key => {
            let assetKey = `common/${key}`;
            loadPromises.push(
                assetLoader.loadInfileAsset(assetKey)
                .then(content => {
                    this.state.commonAssetRelativePaths[key] =
                        this.getAssetRelativePath(
                            assetKey,
                            content
                        )
                })
            );
        });

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
                                replacementMap[matched] = 
                                    this.getAssetRelativePath(
                                        assetKey,
                                        content
                                    );
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
    getAssetRelativePath(assetKey, assetPathUnderResource) {
        return path.join(
            path.relative(paths.PROJECT_DIR, paths.RESOURCES_PATH),
            path.dirname(assetKey),
            assetPathUnderResource
        ); // dirname is the containing folder of the asset
    },
    processMustacheEscapeInText(text) {
        const matchEscapedMustache = /\\({)|\\(})/g;
        return text.replace(matchEscapedMustache, '$1$2')
    },
    loadLevel(levelName) {
        this.state.stepsReady = false;
        this.state.levelName = levelName;

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

                        let repoStorePath = path.join(
                            paths.PLAYGROUND_PATH,
                            paths.REPO_STORE_COLLECTION_NAME,
                        );

                        if (repoVcsSetup.checkpointStoreName) {
                            initializeRepos.push(
                                initializeCheckpointStore(
                                    repoStorePath,
                                    repoVcsSetup.checkpointStoreName
                                )
                            );
                        }

                        if (repoVcsSetup.referenceStoreName) {
                            initializeRepos.push(
                                initializeRepoStore(
                                    repoStorePath,
                                    repoVcsSetup.referenceStoreName,
                                    assetLoader
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
                            paths.REPO_STORE_COLLECTION_NAME,
                            assetLoader,
                            repoVcsSetups
                        );
                });
            })
            .catch(err => {
                console.error(`Error occured when loading repo setups ${err}`);
                throw err;
            })
            .then(() => {
                console.log(`loading ${levelName} steps`);
                loadLevelSteps.call(this, config);
            })
            .catch(err => {
                console.error(`error occured when loading level ${levelName}`);
                throw err;
            });
        })
        .catch(err => {
            console.error(err);
            throw err;
        });
    },
    verifyInputAnswer(stepKey, input) {
        let stepState = this.state.stepStates[stepKey];

        assert(stepState.step instanceof stepConfigs.VerifyInputStep, `VerifyInputAnswer is expected to be invoked by a VerifyInputStep, but is actually invoked by ${stepState.step} at index ${stepKey} `);

        let processedAnswer;
        return Promise.resolve()
        .then(() => {
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
            return input === processedAnswer;
        });
    },
    executeActions(actions) {

        let thread = Promise.resolve();
        actions.forEach(action => {
            thread = thread.then(() => {
                return action.executeBy(this.state.actionExecutor);
            })
        });

        return thread
        .then(() => {
            return true;
        })
        .catch(err => {
            console.error(err);
            return false;
        })
    },
    saveCheckpoint(stepKey) {
        let stepState = this.state.stepStates[stepKey];

        assert(stepState.step instanceof stepConfigs.CheckpointStep, `Only CheckpointStep can invoke saveCheckpoint method in store, but ${stepKey} is not`);

        return Promise.resolve()
        .then(() => {
            let action = new actionConfigs.SaveCheckpointAction(
                stepState.step.repoSetupName,
                stepState.step.checkpointName
            );

            return action.executeBy(this.state.actionExecutor);
        })
        .then(() => {
            this.state.checkpoints[stepKey] = new StoreStateCheckpoint(this.state);
        })
        .then(() => {
            return true;
        })
        .catch(error => {
            console.error(error);
            return false;
        });
    },
    loadCheckpoint(stepKey) {
        let stepState = this.state.stepStates[stepKey];

        assert(stepState.step instanceof stepConfigs.CheckpointStep, `Only CheckpointStep can invoke loadCheckpoint method in store, but ${stepKey} is not`);
        assert(stepKey in this.state.checkpoints);

        return Promise.resolve()
        .then(() => {
            let action = new actionConfigs.LoadCheckpointAction(
                stepState.step.repoSetupName,
                stepState.step.checkpointName
            );

            return action.executeBy(this.state.actionExecutor);
        })
        .then(() => {
            let checkpoint = this.state.checkpoints[stepKey];
            checkpoint.applyTo(this.state);
        })
        .then(() => {
            return true;
        })
        .catch(error => {
            console.error(error);
            return false;
        });
    },
    verifyRepoEqual(stepKey) {
        let stepState = this.state.stepStates[stepKey];

        assert(stepState.step instanceof stepConfigs.VerifyRepoStep, `Only VerifyRepoStep can invoke verifyRepoEqual method in store, but ${stepKey} is actuall ${typeof(stepKey.step)}`);
        
        return Promise.resolve()
        .then(() => {
            let referenceName = stepState.step.referenceName || `${this.state.levelName}-${stepKey}`;

            let action = new actionConfigs.CompareReferenceAction(
                stepState.step.repoSetupName,
                referenceName
            );

            return action.executeBy(this.state.actionExecutor);
        })
        .catch(error => {
            console.error(error);
            return false;
        });
    },
    unblock(stepKey) {
        let unblockedIndex = parseInt(stepKey);
        assert(unblockedIndex <= this.state.currentBlockingStep, `Expect unblocked index ${unblockedIndex} should be smaller than or equal to currently blocking index ${this.state.currentBlockingStep}`);
        assert(unblockedIndex <= this.state.minProcessingStep, `Expect all previous processing steps completed before unblocking for index ${unblockedIndex}`);

        let blockingStepArrayIndex = this.state.blockingSteps.indexOf(unblockedIndex);
        if (blockingStepArrayIndex != this.state.blockingSteps.length - 1) {
            this.state.currentBlockingStep = this.state.blockingSteps[blockingStepArrayIndex + 1];
        }
        else {
            this.state.currentBlockingStep = Object.keys(this.state.stepStates).length;
        }

        this.updateBlockingStates();
    },
    markProcessComplete(stepKey) {
        let index = parseInt(stepKey);

        if (index === this.state.minProcessingStep) {
            let i = this.state.minProcessingStep + 1;
            for (; i <= this.state.currentBlockingStep; i++) {
                let stepState = this.state.stepStates[`${i}`];
                if (stepState.step.needProcess) {
                    if (stepState.state.processState.current === stepConfigs.ProcessState.PROCESSING) {
                        this.state.minProcessingStep = i;
                        break;
                    }
                }
            }

            if (i === this.state.currentBlockingStep) {
                this.state.minProcessingStep = i;
            }
        }

        // Update the state after updating minProcessingStep
        // because updating state might trigger unblock
        this.state.stepStates[stepKey].state.processState.current = stepConfigs.ProcessState.PROCESS_COMPLETE;
    },
    updateBlockingStates() {
        this.state.minProcessingStep = Object.keys(this.state.stepStates).length;

        Object.keys(this.state.stepStates).forEach(stepKey => {
            let stepState = this.state.stepStates[stepKey];

            let parsedIndex = parseInt(stepKey);
            stepState.state.isBlocked = parsedIndex > this.state.currentBlockingStep;

            if (!stepState.state.isBlocked) {
                if (stepState.step.needProcess && stepState.state.processState.current === stepConfigs.ProcessState.PREPARE_PROCESS) {
                    stepState.state.processState.current = stepConfigs.ProcessState.PROCESSING;
                    this.state.minProcessingStep = Math.min(
                        this.state.minProcessingStep,
                        parsedIndex
                    );
                }
            }
        });
    },
}

exports = module.exports = store;