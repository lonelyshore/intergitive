'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { shell } = require('electron');
//const { dialog } = require('electron').remote;
const marked = require('marked');

const paths = require('./paths');
const zip = require('./simple-archive');
const courseConfig = require('./config-course');
const utility = require('./utility');
const progress = require('../common/progress');
const { State } = require('./state');

const normalizePathSep = require('./noarmalize-path-sep');
const ActionExecutor = require('./action-executor').ActionExecutor;
const loadCourseAsset = require('./load-course-asset');
const stepConfigs = require('./config-step');
const actionConfigs = require('./config-action');
const { create } = require('domain');
const { LEVEL_CONFIG_SCHEMA } = require('./level-config-schema');

const ProcessState = stepConfigs.ProcessState;

const loaderPair = loadCourseAsset.createCourseAssetLoaderPair(
    paths
);

function extendStepConfigsWithRuntimeSteps(steps) {

    let extendedSteps = [];
    let checkpointCount = 0;
    steps.forEach(step => {
        extendedSteps.push(step);

        if (step.appendCheckpoint) {
            let checkpointStep =
                new stepConfigs.AllRepoCheckpointStep(
                    `_gen_checkpoint-#${checkpointCount}`
                );

            checkpointCount++;

            extendedSteps.push(checkpointStep);
        }
    });

    extendedSteps.push(new stepConfigs.SaveProgressStep());
    extendedSteps.push(new stepConfigs.CompleteLevelStep());

    return extendedSteps;
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
                mapping[item.id] = courseProgress.isItemComplete(item.id) === true;
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
            unlockStatusMap[id] = (
                itemToCompleteness[id] === true ?
                    progress.ProgressEnum.COMPLETED :
                    (
                        itemToUnlockStatus[id] === true ?
                            progress.ProgressEnum.UNLOCKED :
                            progress.ProgressEnum.LOCKED
                    )
            );

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
    actionExecutor: null,
    state: {
        levelState: {
            repoSetupNames: [],
            workingPaths: null,
            steps: [],
            isDebug: true,
        },
        courseState: {
            courseName: null,
        },
        pageState: {
            displayingNode: null
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
    get loaderPair() {
        return loaderPair;
    },
    execute(actionContent) {
        return Promise.resolve(yaml.load(actionContent, { schema: LEVEL_CONFIG_SCHEMA}))
        .then(action => {
            console.log(action);
            return action.executeBy(this.actionExecutor);
        });
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
                            ),
                            utility.getConcatMustacheReplaced(
                                baseText,
                                nextIndex,
                                (replacement) => {
                                    return Promise.resolve(
                                        path.dirname(this.state.levelState.workingPaths[replacement.matchedContent])
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
    setCurrentCourse(courseName) {
        this.courseState.courseName = courseName;
    },
    loadLevel(levelName) {
        this.levelState.steps = {};
        this.actionExecutor = null;
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
                    this.actionExecutor = 
                        new ActionExecutor(
                            paths.playgroundPath,
                            paths.repoStoreCollectionName,
                            loaderPair.getCourseLoader(this.courseState.courseName),
                            repoVcsSetups
                        );
                })
                .then(() => {
                    this.levelState.steps = extendStepConfigsWithRuntimeSteps(config.steps);
                });
            })
            .catch(err => {
                console.error(`Error occured when loading repo setups ${err}`);
                if (err.code === 'EBUSY') {
                    return loaderPair.loadCommonString('loadEbusyMessage')
                    .then(message => {
                        // return dialog.showMessageBox({
                        //     message: message
                        // });
                    })
                    .then(() => {
                        throw err;
                    });
                }
                throw err;
            })
            .then(() => {
                let ret = Object.assign({}, this.levelState);
                ret.steps = yaml.dump(this.levelState.steps, { schema: LEVEL_CONFIG_SCHEMA });
                return ret;
            });
        })
        .catch(err => {
            console.error(err);
            throw err;
        });
    },
    openWorkingPath(workingPath) {
        return new Promise(resolve => {
            shell.openItem(workingPath);
            resolve(true);
        });
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