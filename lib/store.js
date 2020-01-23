'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { shell } = require('electron');
const marked = require('marked');

const paths = require('../paths');
const zip = require('./simple-archive');
const courseConfig = require('./config-course');
const levelSchema = require('./level-config-schema').LEVEL_CONFIG_SCHEMA;
const courseSchema = require('./course-config-schema').COURSE_CONFIG_SCHEMA;
const normalizePathSep = require('./noarmalize-path-sep');
const AssetLoader = require('./asset-loader').AssetLoader;
const ActionExecutor = require('./action-executor').ActionExecutor;
const stepConfigs = require('./config-step');
const actionConfigs = require('./config-action');

const ProcessState = stepConfigs.ProcessState;

const assetLoader = new AssetLoader(paths.resourcesPath);
assetLoader.setBundlePath(...paths.bundlePath);

const courseAssetLoader = new AssetLoader(paths.courseResourcesPath);

function loadLevelSteps(config) {

    let renderStepsBuffer = [];
    let stepStatesBuffer = {};
    let blockingStepsBuffer = [];
    let needProcessStepsBuffer = [];

    let steps = Object.assign([], config.steps);

    steps.push(new stepConfigs.CompleteLevelStep());

    steps.forEach((step, index) => {
        
        let indexString = `${index}`;

        if (step.componentType) {
            renderStepsBuffer.push(indexString);
        }

        if (step.isBlocking) {
            blockingStepsBuffer.push(index);
        }

        if (step.needProcess) {
            needProcessStepsBuffer.push(index);
        }

        let initialState = step.createInitialState();

        stepStatesBuffer[indexString] = {
            step: step,
            state: initialState,
            deepCloneInto: step.deepCloneInto
        }
    });

    this.levelState.renderSteps = renderStepsBuffer;
    this.levelState.stepStates = stepStatesBuffer;
    this.levelState.blockingSteps = blockingStepsBuffer;
    this.levelState.needProcessSteps = needProcessStepsBuffer;
    

    // Process blocking issue
    this.levelState.currentBlockingStep = 
        this.levelState.blockingSteps.length !== 0
        ? this.levelState.blockingSteps[0]
        : config.length;

    this.levelState.minProcessingStep = 0;

    this.updateBlockingStates();

    this.levelState.stepsReady = true;
    this.levelState.interactable = true;
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
        levelState: {
            isDebug: false,
            stepsReady: false,
            interactable: false,
            levelName: '',
            terms: {
                elaborate: '',
                illustrate: '',
                instruct: '',
                verifyInputPlaceholder: '',
                verifyInputSubmitText: '',
                verifyInputFailed: '',
                verifyRepoDescription: '',
                checkpointReadyToSave: '',
                checkpointSaving: '',
                checkpointLoading: '',
                checkpointReadyToLoad: '',
                loadReference: '',

                startOperationButton: '',
                operationStatus: '',
                operationReady: '',
                operationRunning: '',
                operationFailed: '',
                operationCompleted: '',
                checkpointSaveButton: '',
                checkpointLoadButton: '',
                openWorkingPathDescription: '',
                preCompleteLevelDescription: '',
                generalExecutionDescription: '',
                completeLevelDescription: '',
                buttonConfirmText: '',
            },
            commonAssetRelativePaths: {
                imgCorrect: '',
            },
            renderSteps: [],
            stepStates: {},
            blockingSteps: [],
            needProcessSteps: [],
            currentBlockingStep: Number.MAX_SAFE_INTEGER,
            minProcessingStep: Number.MAX_SAFE_INTEGER,
            actionExecutor: null,
            checkpoints: {},
            repoSetupNames: [],
            workingPaths: {},
        },
        courseState: {
            isReady: false,
            courseTree: null,
            courseList: null,
        },
        pageState: {
            displayingNode: null,
        }
    },
    get levelState() {
        return this.state.levelState;
    },
    get courseState() {
        return this.state.courseState;
    },
    get pageState() {
        return this.state.pageState;
    },
    loadTerms() {
        let loadPromises = [];

        Object.keys(this.levelState.terms).forEach(key => {
            loadPromises.push(
                assetLoader.loadTextContent(`render/${key}`)
                .then(term => {
                    this.levelState.terms[key] = term;
                })
            )
        })

        return Promise.all(loadPromises);
    },
    loadCommonAssetRelativePaths() {
        let loadPromises = [];

        Object.keys(this.levelState.commonAssetRelativePaths).forEach(key => {
            let assetKey = `common/${key}`;
            loadPromises.push(
                assetLoader.getFullAssetPath(assetKey)
                .then(fullAssetPath => {
                    this.levelState.commonAssetRelativePaths[key] =
                        this.getAssetRelativePath(
                            fullAssetPath
                        )
                })
            );
        });

        return Promise.all(loadPromises);
    },
    loadText(assetId) {
        return courseAssetLoader.loadTextContent(assetId);
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
                            courseAssetLoader.loadTextContent(assetKey)
                            .then(content => {
                                replacementMap[matched] = content;
                            })
                        )
                    }
                    else {
                        let assetKey = matched.slice(2, matched.length - 2).trim();
                        setReplacementMap.push(
                            courseAssetLoader.getFullAssetPath(assetKey)
                            .then(fullAssetPath => {
                                replacementMap[matched] = 
                                    this.getAssetRelativePath(
                                        fullAssetPath
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
    processMarkdown(content) {
        if (content.startsWith('.md')) {
            return marked(content.slice(3));
        }
        else {
            return content;
        }
        
    },
    getAssetRelativePath(assetFullPath) {
        return normalizePathSep.posix(
            path.relative(paths.projectPath, assetFullPath)
        );
    },
    processMustacheEscapeInText(text) {
        const matchEscapedMustache = /\\({)|\\(})/g;
        return text.replace(matchEscapedMustache, '$1$2')
    },
    loadCourse(courseName) {
        this.courseState.isReady = false;
        this.courseState.courseTree = null;
        this.courseState.courseList = null;

        courseAssetLoader.setBundlePath(courseName);

        return assetLoader.loadTextContent(`course/${courseName}`)
        .then(content => {
            console.log(`loading ${courseName} json`);
            return yaml.safeLoad(content, { schema: courseSchema});
        })
        .then(course => {
            this.courseState.courseTree = this.buildCourseTree(course);
            this.courseState.courseList = courseConfig.flattenCourseTree(course);
            this.courseState.isReady = true;
        })
        .catch(err => {
            console.error(err);
            this.courseState.isReady = false;
        });;
    },
    loadLevel(levelName) {
        this.levelState.stepsReady = false;
        this.levelState.interactable = false;
        this.levelState.levelName = levelName;
        this.levelState.renderSteps = [];
        this.levelState.stepStates = {};
        this.levelState.blockingSteps = [];
        this.levelState.needProcessSteps = [];
        this.levelState.currentBlockingStep = Number.MAX_SAFE_INTEGER;
        this.levelState.minProcessingStep = Number.MAX_SAFE_INTEGER;
        this.levelState.actionExecutor = null;
        this.levelState.checkpoints = {};
        this.levelState.repoSetupNames = [];
        this.levelState.workingPaths = {};

        return courseAssetLoader.loadTextContent(`${levelName}`)
        .then(text => {
            console.log(`loading ${levelName} json`);
            return yaml.safeLoad(text, { schema: levelSchema });
        })
        .then(config => {
            
            return Promise.resolve()
            .then(() => {
                console.log(`loading ${levelName} repo setups`);

                let initializeRepos = [];
                let repoVcsSetups = config.repoVcsSetups;
                
                if (repoVcsSetups) {
                    this.levelState.workingPaths = {};

                    this.levelState.repoSetupNames = Object.keys(repoVcsSetups);

                    this.levelState.repoSetupNames.forEach(repoVcsSetupName => {
                        let repoVcsSetup = repoVcsSetups[repoVcsSetupName];

                        this.levelState.workingPaths[repoVcsSetupName] = 
                            path.join(
                                paths.playgroundPath,
                                repoVcsSetup.workingPath
                            );
                        

                        if (repoVcsSetup.workingPath) {
                            initializeRepos.push(
                                initializeWorkingPath(
                                    path.join(paths.playgroundPath, repoVcsSetup.workingPath)
                                )
                            );
                        }

                        let repoStorePath = path.join(
                            paths.playgroundPath,
                            paths.repoStoreCollectionName,
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
                                    courseAssetLoader
                                )
                            );
                        }
                    });
                }

                return Promise.all(initializeRepos)
                .then(() => {
                    this.levelState.actionExecutor = 
                        new ActionExecutor(
                            paths.playgroundPath,
                            paths.repoStoreCollectionName,
                            courseAssetLoader,
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
        let stepState = this.levelState.stepStates[stepKey];

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

        this.levelState.interactable = false;

        let thread = Promise.resolve();

        actions.forEach(action => {
            thread = thread.then(() => {
                return action.executeBy(this.levelState.actionExecutor);
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
        .finally(() => {
            this.levelState.interactable = true;
        });
    },
    saveCheckpoint(stepKey) {
        this.levelState.interactable = false;

        let stepState = this.levelState.stepStates[stepKey];

        assert(
            stepState.step instanceof stepConfigs.CheckpointStep
            || stepState.step instanceof stepConfigs.AllRepoCheckpointStep,
            `Only CheckpointStep or AllRepoCheckpointStep can invoke saveCheckpoint method in store, but ${stepKey} is not`);

        return Promise.resolve()
        .then(() => {
            let executeSaveCheckpoints = Promise.resolve();

            let repoSetupNames = 
                stepState.step instanceof stepConfigs.CheckpointStep
                ? stepState.step.repoSetupNames
                : this.levelState.repoSetupNames;

            repoSetupNames.forEach(repoSetupName => {
                let action = new actionConfigs.SaveCheckpointAction(
                    repoSetupName,
                    stepState.step.checkpointName
                );
    
                executeSaveCheckpoints = executeSaveCheckpoints.then(() => {
                    return action.executeBy(this.levelState.actionExecutor);
                });
            });

            return executeSaveCheckpoints;
        })
        .then(() => {
            this.levelState.checkpoints[stepKey] = new StoreStateCheckpoint(this.levelState);
        })
        .then(() => {
            return true;
        })
        .catch(error => {
            console.error(error);
            return false;
        })
        .finally(() => {
            this.levelState.interactable = true;
        });
    },
    loadCheckpoint(stepKey) {
        this.levelState.interactable = false;

        let stepState = this.levelState.stepStates[stepKey];

        assert(
            stepState.step instanceof stepConfigs.CheckpointStep
            || stepState.step instanceof stepConfigs.AllRepoCheckpointStep,
            `Only CheckpointStep or AllRepoCheckpointStep can invoke loadCheckpoint method in store, but ${stepKey} is not`);

        assert(stepKey in this.levelState.checkpoints);

        return Promise.resolve()
        .then(() => {
            let loadCheckpoints = Promise.resolve();

            let repoSetupNames = 
                stepState.step instanceof stepConfigs.CheckpointStep
                ? stepState.step.repoSetupNames
                : this.levelState.repoSetupNames;

            repoSetupNames.forEach(repoSetupName => {
                let action = new actionConfigs.LoadCheckpointAction(
                    repoSetupName,
                    stepState.step.checkpointName
                );

                loadCheckpoints = loadCheckpoints.then(() => {
                    return action.executeBy(this.levelState.actionExecutor);  
                });
            })

            return loadCheckpoints;
        })
        .then(() => {
            let checkpoint = this.levelState.checkpoints[stepKey];
            checkpoint.applyTo(this.levelState);
        })
        .then(() => {
            return true;
        })
        .catch(error => {
            console.error(error);
            return false;
        })
        .finally(() => {
            this.levelState.interactable = true;
        });
    },
    verifyRepoEqual(stepKey) {
        this.levelState.interactable = false;

        let stepState = this.levelState.stepStates[stepKey];

        assert(
            stepState.step instanceof stepConfigs.VerifyRepoStep
            || stepState.step instanceof stepConfigs.VerifyAllRepoStep, 
            `Only VerifyRepoStep or VerifyAllRepoStep can invoke verifyRepoEqual method in store, but ${stepKey} is actuall ${typeof(step)}`);
        
        return Promise.resolve()
        .then(() => {
            let referenceName = stepState.step.referenceName || `${this.levelState.levelName}-${stepKey}`;

            let verifyRepos = Promise.resolve();

            let repoSetupNames =
                stepState.step instanceof stepConfigs.VerifyRepoStep
                ? [stepState.step.repoSetupName]
                : this.levelState.repoSetupNames;

            let resultMapping = {};

            repoSetupNames.forEach(repoSetupName => {

                let action = new actionConfigs.CompareReferenceAction(
                    repoSetupName,
                    referenceName
                );

                verifyRepos = verifyRepos.then(() => {
                    return action.executeBy(this.levelState.actionExecutor)
                    .then(result => {
                        resultMapping[repoSetupName] = result;
                    });
                });
            });

            return verifyRepos.then(() => {
                return Object.keys(resultMapping).every(key => resultMapping[key]);
            });
        })
        .catch(error => {
            console.error(error);
            return false;
        })
        .finally(() => {
            this.levelState.interactable = true;
        });
    },
    loadLastLevelFinalSnapshot(stepKey) {
        let currentLevel = this.state.pageState.displayingNode;
        let previousLevel = courseConfig.findLastLevel(
            this.courseState.courseList,
            currentLevel
        );

        if (previousLevel === null) {
            console.error(`Failed to find pervious level for ${currentLevel.id}`);
            return Promise.resolve(false);
        }
        else {
            let step = this.state.levelState.stepStates[stepKey].step;

            assert(
                step instanceof stepConfigs.LoadLastLevelFinalSnapshotStep,
                `Expect LoadLastStageFinalSnapshotStep invoking store.loadLastLevelFinalSnapshot, but actually invoked by ${stepKey} which is of type ${typeof(step)}`
            );

            let actions = step.repoSetupNames.map(repoSetupName => {
                return new actionConfigs.LoadReferenceAction(
                    repoSetupName,
                    `${previousLevel.id}-final-snapshot`
                );
            });

            return this.executeActions(actions);
        }
    },
    openWorkingPath(stepKey) {
        return new Promise(resolve => {
            let step = this.levelState.stepStates[stepKey].step;

            assert(step instanceof stepConfigs.OpenWorkingPathStep, `Only OpenWorkingPathStep can invoke OpenWorkingPath method, but ${stepKey} is actually ${typeof(step)}`);

            shell.openItem(this.levelState.workingPaths[step.repoSetupName]);

            resolve(true);
        });
    },
    unblock(stepKey) {
        let unblockedIndex = parseInt(stepKey);
        assert(unblockedIndex <= this.levelState.currentBlockingStep, `Expect unblocked index ${unblockedIndex} should be smaller than or equal to currently blocking index ${this.levelState.currentBlockingStep}`);
        assert(unblockedIndex <= this.levelState.minProcessingStep, `Expect all previous processing steps completed before unblocking for index ${unblockedIndex}`);

        let blockingStepArrayIndex = this.levelState.blockingSteps.indexOf(unblockedIndex);
        if (blockingStepArrayIndex != this.levelState.blockingSteps.length - 1) {
            this.levelState.currentBlockingStep = this.levelState.blockingSteps[blockingStepArrayIndex + 1];
        }
        else {
            this.levelState.currentBlockingStep = Object.keys(this.levelState.stepStates).length;
        }

        this.updateBlockingStates();
    },
    markProcessComplete(stepKey) {
        let index = parseInt(stepKey);

        if (index === this.levelState.minProcessingStep) {
            let i = this.levelState.minProcessingStep + 1;
            for (; i <= this.levelState.currentBlockingStep; i++) {
                let stepState = this.levelState.stepStates[`${i}`];
                if (stepState.step.needProcess) {
                    if (stepState.state.processState === ProcessState.PROCESSING) {
                        this.levelState.minProcessingStep = i;
                        break;
                    }
                }
            }

            if (i === this.levelState.currentBlockingStep) {
                this.levelState.minProcessingStep = i;
            }
        }

        // Update the state after updating minProcessingStep
        // because updating state might trigger unblock
        this.levelState.stepStates[stepKey].state.processState = ProcessState.PROCESS_COMPLETE;
    },
    updateBlockingStates() {
        this.levelState.minProcessingStep = Object.keys(this.levelState.stepStates).length;

        Object.keys(this.levelState.stepStates).forEach(stepKey => {
            let stepState = this.levelState.stepStates[stepKey];

            let parsedIndex = parseInt(stepKey);
            stepState.state.isBlocked = parsedIndex > this.levelState.currentBlockingStep;

            if (!stepState.state.isBlocked) {
                if (stepState.step.needProcess && stepState.state.processState === ProcessState.PREPARE_PROCESS) {
                    stepState.state.processState = ProcessState.PROCESSING;
                    this.levelState.minProcessingStep = Math.min(
                        this.levelState.minProcessingStep,
                        parsedIndex
                    );
                }
            }
        });
    },
    buildCourseTree(course) {

        course.parent = null;

        let queue = [course];

        while (queue.length !== 0) {
            let current = queue.shift();
            
            if (current instanceof courseConfig.NestedNamedCourseItem) {
                current.children.forEach(child => {
                    child.parent = current;
                    queue.push(child);
                });


            }
            
            if (current instanceof courseConfig.SequentialSectionItem) {
                let previousIds = [];
                current.children.forEach(child => {
                    child.prerequisiteIds = child.prerequisiteIds.concat(previousIds);
                    previousIds.push(child.id);
                });
            }
        }

        return course;
    },
    navigate(node) {
        return Promise.resolve()
        .then(() => {
            if (node instanceof courseConfig.LevelItem) {
                return this.loadLevel(node.configAssetId)
                .then(() => {
                    this.pageState.displayingNode = node;
                });
            }
            else {
                this.pageState.displayingNode = node;
            }
        })

    },
    completeLevel() {
        return Promise.resolve()
        .then(() => {
            this.pageState.displayingNode = this.pageState.displayingNode.parent;
        })
    }
}

exports = module.exports = store;