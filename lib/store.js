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
const utility = require('./utility');
const progress = require('./progress');

const normalizePathSep = require('./noarmalize-path-sep');
const ActionExecutor = require('./action-executor').ActionExecutor;
const loadCourseAsset = require('./load-course-asset');
const stepConfigs = require('./config-step');
const actionConfigs = require('./config-action');

const ProcessState = stepConfigs.ProcessState;

const loaderPair = loadCourseAsset.createCourseAssetLoaderPair(
    paths
);

function loadLevelSteps(config) {

    let renderStepsBuffer = [];
    let stepStatesBuffer = {};
    let blockingStepsBuffer = [];
    let needProcessStepsBuffer = [];

    let steps = [];
    let checkpointCount = 0;
    config.steps.forEach(step => {
        steps.push(step);

        if (step.appendCheckpoint) {
            let checkpointStep =
                new stepConfigs.AllRepoCheckpointStep(
                    `_gen_checkpoint-#${checkpointCount}`
                );

            checkpointCount++;

            steps.push(checkpointStep);
        }
    });

    steps.push(new stepConfigs.SaveProgressStep());
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

function executeActionsSequentially(actions) {
    let thread = Promise.resolve();

    actions.forEach(action => {
        thread = thread.then(() => {
            return action.executeBy(this.levelState.actionExecutor);
        })
    });

    return thread;
}

function assembleLoadReferenceActions(repoSetupNames, referenceName) {

    let actions = [];
    repoSetupNames.forEach(repoSetupName => {
        let action = new actionConfigs.LoadReferenceAction(
            repoSetupName,
            referenceName
        );

        actions.push(action);
    });

    return actions;
}

function getRepoSetupNamesForStep(step) {
    if (step instanceof stepConfigs.VerifyRepoStep) {
        return [step.repoSetupName];
    }
    else if (step instanceof stepConfigs.LoadReferenceStep) {
        return [step.repoSetupName];
    }
    else if (step instanceof stepConfigs.VerifyAllRepoStep) {
        return this.levelState.repoSetupNames;
    }
    else if (step instanceof stepConfigs.LoadAllReferenceStep) {
        return this.levelState.repoSetupNames;
    }
    else if (step instanceof stepConfigs.LoadLastLevelFinalSnapshotStep) {
        return step.repoSetupNames || this.levelState.repoSetupNames;
    }
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

function initializeRepoStore(storePath, refStoreName, loaderPair, courseName) {
    let refStorePath = path.join(storePath, refStoreName);
    return fs.emptyDir(refStorePath)
    .then(() => {
        return loaderPair.loadRepoArchivePath(refStoreName, courseName);
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


/**
 * 
 * @param {progress.ProgressProvider} progressProvider 
 * @param {string} courseName 
 * @param {courseConfig.NamedCourseItem} courseTree
 * @returns {Object} a mapping from course item to unlock status
 */
function calculateCourseUnlockStatus(progressProvider, courseName, courseTree) {

    return progressProvider.getProgress(courseName)
    .then(courseProgress => {
        let courseItems = courseConfig.flattenCourseTree(courseTree);

        let itemToCompletenessFirstPass = courseItems.reduce(
            (mapping, item) => {
                mapping[item.id] = courseProgress.isItemComplete(item.id);
                return mapping;
            },
            {}
        );

        let itemToCompleteness = courseItems.reduce(
            (mapping, item) => {
                if (item.children) {
                    mapping[item.id] = item.children.map(
                        child => itemToCompletenessFirstPass[child.id]
                    )
                    .every(result => result === true);
                }
                else {
                    mapping[item.id] = itemToCompletenessFirstPass[item.id];
                }

                return mapping;
            },
            {}
        );

        return {
            courseItems: courseItems,
            itemToCompleteness: itemToCompleteness
        };
    })
    .then(prev => {
        let courseItems = prev.courseItems;
        let itemToCompleteness = prev.itemToCompleteness;

        let itemToParent = courseItems.reduce(
            (mapping, current) => {
                if (current.children) {
                    current.children.forEach(child => {
                        mapping[child] = current;
                    });
                }
                
                return mapping;
            },
            {}
        );

        function IsUnlockIfPrerequisitesCompleted(item, arePrerequisitesCompletedCb) {
            return arePrerequisitesCompletedCb(item) ?
                true :
                false;
        }

        let stautsResolverGenerater = new courseConfig.CourseItemVisitor(
            (levelItem) => {
                return (item) => 
                    new Error(`Should not need to check progress of an item ${item} that has parent of levelItem ${levelItem}`)
            },
            (sequentialSectionItem) => {
                return (item) => {
                    return IsUnlockIfPrerequisitesCompleted(
                        item, 
                        (item) =>{
                            let prerequisiteCompleted =
                                arePrequesitesCompleted(item, itemToCompleteness);

                            let index = sequentialSectionItem.children.indexOf(item);
                            if (index < 0) {
                                return new Error(`Claimed that item ${item} has sequentialItem parent ${sequentialSectionItem}, but it actually does not`);
                            }
                            else if (index > 0) {
                                let previousItem = sequentialSectionItem.children[index - 1];
                                prerequisiteCompleted &= itemToCompleteness[previousItem.id];
                            }

                            return prerequisiteCompleted;
                        }
                    );
                };
            },
            (FreeAccessSectionItem) => {
                return (item) => {
                    return IsUnlockIfPrerequisitesCompleted(
                        item,
                        item => arePrequesitesCompleted(item, itemToCompleteness)
                    )
                };
            },
            (courseItem) => {
                return (item) => {
                    return IsUnlockIfPrerequisitesCompleted(
                        item,
                        item => arePrequesitesCompleted(item, itemToCompleteness)
                    )
                };
            }
        );

        let itemToUnlockStatus = courseItems.reduce(
            (mapping, current) => {
                let parent = itemToParent[current];

                if (parent) {
                    let statusResolver = parent.accept(stautsResolverGenerater);
                    mapping[current.id] = statusResolver(current);
                }
                else { // When a course item node has no parent (root), it is unlocked by default
                    mapping[current.id] = true;
                }

                return mapping;
            },
            {}
        );

        let unlockStatusMap = {};
        courseItems.forEach(item => {
            let id = item.id;
            unlockStatusMap[id] = itemToCompleteness[id] === true ?
                progress.ProgressEnum.COMPLETED :
                itemToUnlockStatus[id] === true ?
                    progress.ProgressEnum.UNLCOKED :
                    progress.ProgressEnum.LOCKED;

        });

        return unlockStatusMap;
    });

    function arePrequesitesCompleted(item, itemToCompleteness) {
        if (item.prerequisiteIds) {
            return item.prerequisiteIds.every(id => itemToCompleteness[id] === true);
        }
        else {
            return true;
        }
    }

}

let store = {
    state: {
        levelState: {
            isDebug: true,
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
                saveProgress: '',

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
            courseItemIdToUnlockStatus: null,
            courseName: ''
        },
        pageState: {
            displayingNode: null,
        },
        progress: new progress.ProgressProvider(paths.progressPath)
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
                loaderPair.loadCommonString(key)
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
            loadPromises.push(
                loaderPair.loadCommonAssetPath(key)
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
        return loaderPair.loadCourseText(assetId, this.state.courseState.courseName);
    },
    processAssetIdInText(text) {
        return utility.searchMustacheReplacementPairs(
            text,
            loaderPair.getCourseLoader(this.courseState.courseName)
        )
        .then(replacements => {
            let baseText = replacements.length === 0 ? text : text.substring(0, replacements[0].startingIndex);
            
            let loader = loaderPair.getCourseLoader(this.courseState.courseName);

            return replacements.reduce(
                (concatReplacements, replacement, replacementIndex) => {
                    return concatReplacements.then(baseText => {
                        let nextIndex = replacementIndex === replacements.length - 1 
                            ? text.length
                            : replacements[replacementIndex + 1].startingIndex;

                        return replacement.match(
                            utility.getConcatMustacheReplaced(
                                baseText, 
                                nextIndex,
                                (replacement) => {
                                    return loader.getFullAssetPath(replacement.matchedContent)
                                    .then(fullPath => this.getAssetRelativePath(fullPath));
                                }),
                            utility.getConcatMustacheReplaced(
                                baseText,
                                nextIndex,
                                (replacement) => loader.loadTextContent(replacement.matchedContent)),
                            utility.getConcatMustacheReplaced(
                                baseText,
                                nextIndex,
                                (replacement) => {
                                    return Promise.resolve(
                                        this.state.levelState.workingPaths[replacement.matchedContent]
                                    )
                                }
                            )
                        );
                    });
                },
                Promise.resolve(baseText)
            );
        })
        .then(replacedText => {
            return utility.processMustacheEscapeInText(replacedText);
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
    loadCourse(courseName) {
        this.courseState.isReady = false;
        this.courseState.courseTree = null;
        this.courseState.courseList = null;

        return loaderPair.loadCourse(courseName)
        .then(course => {
            this.courseState.courseTree = this.buildCourseTree(course);
            this.courseState.courseList = courseConfig.flattenCourseTree(course);
            this.courseState.isReady = true;
            this.courseState.courseName = courseName;
        })
        .then(() => {
            return this.state.progress.getProgress(this.state.courseState.courseName);
        })
        .then(() => {
            return calculateCourseUnlockStatus(
                    this.state.progress,
                    this.courseState.courseName, 
                    this.courseState.courseTree
            )
            .then(unlockStatus => {
                this.courseState.courseItemIdToUnlockStatus = unlockStatus;
            });
        })
        .catch(err => {
            console.error(err);
            this.courseState.isReady = false;
            this.courseState.courseName = '';
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

        return loaderPair.loadLevelFromCourse(levelName, this.courseState.courseName)
        .then(config => {
            
            return Promise.resolve()
            .then(() => fs.emptyDir(paths.playgroundPath))
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
                                    loaderPair,
                                    this.courseState.courseName
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
                            loaderPair.getCourseLoader(this.courseState.courseName),
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

        return executeActionsSequentially.call(this, actions)
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
            let referenceName = stepState.step.referenceName;// || `${this.levelState.levelName}-${stepKey}`;

            assert(
                referenceName,
                `step with key ${stepKey} should define referenceName`
            );

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
    loadRepoReferenceForVerifyStep(stepKey) {

        if (!this.levelState.isDebug) return Promise.resolve(new Error('loadRepoReferenceForVerifyStep is debug only!'));

        this.levelState.interactable = false;

        let stepState = this.levelState.stepStates[stepKey];

        assert(
            stepState.step instanceof stepConfigs.VerifyAllRepoStep
            || stepState.step instanceof stepConfigs.VerifyRepoStep,
            `Only VerifyAllRepoStep or VerifyRepoStep can invoke loadCheckpoint method in store, but ${stepKey} is not`);
    
        return Promise.resolve(getRepoSetupNamesForStep.call(this, stepState.step))
        .then(repoSetupNames => {
            return assembleLoadReferenceActions(
                repoSetupNames,
                stepState.step.referenceName
            );
        })
        .then(actions => {
            return this.executeActions(actions);
        });
    },
    loadAllRepoReferences(stepKey) {
        let stepState = this.levelState.stepStates[stepKey];
        assert(
            stepState.step instanceof stepConfigs.LoadAllReferenceStep,
            `Only LoadAllReferenceStep can invoke loadAllRepoReference method, but actually is ${stepKey} is not`
        );

        return Promise.resolve(getRepoSetupNamesForStep.call(this, stepState.step))
        .then(repoSetupNames => {
            return assembleLoadReferenceActions(
                repoSetupNames,
                stepState.step.referenceName
            );
        })
        .then(actions => {
            return this.executeActions(actions);
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
            this.levelState.interactable = false;
            
            let step = this.state.levelState.stepStates[stepKey].step;

            assert(
                step instanceof stepConfigs.LoadLastLevelFinalSnapshotStep,
                `Expect LoadLastStageFinalSnapshotStep invoking store.loadLastLevelFinalSnapshot, but actually invoked by ${stepKey} which is of type ${typeof(step)}`
            );

            return Promise.resolve(getRepoSetupNamesForStep.call(this, step))
            .then(repoSetupNames => {
                return assembleLoadReferenceActions(
                    repoSetupNames,
                    `${previousLevel.id}-final-snapshot`
                );
            })
            .then(actions => {
                return this.executeActions(actions);
            });
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
                    this.state.pageState.displayingNode = node;
                });
            }
            else {
                this.state.pageState.displayingNode = node;
            }
        })

    },
    saveProgress() {
        let currentLevel = this.state.pageState.displayingNode;

        return this.state.progress.getProgress(this.state.courseState.courseName)
        .then(progress => {
            return progress.setItemComplete(currentLevel.id);
        })
        .then(() => {
            return calculateCourseUnlockStatus(
                this.state.progress,
                this.courseState.courseName,
                this.courseState.courseTree
            )
            .then(unlockStatus => {
                this.courseState.courseItemIdToUnlockStatus = unlockStatus;
            })
        })
        .catch(err => {
            console.error(err);
            return false;
        })
        .then(() => {
            return true;
        });
    },
    completeLevel() {
        return Promise.resolve()
        .then(() => {
            this.state.pageState.displayingNode = this.state.pageState.displayingNode.parent;
        })
    }
}

exports = module.exports = store;