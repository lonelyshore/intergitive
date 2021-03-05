'use strict';

const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const { shell } = require('electron');
const marked = require('marked');

const paths = require('../paths');
const zip = require('./simple-archive');
const courseConfig = require('./config-course');
const utility = require('./utility');
const progress = require('../common/progress');

const normalizePathSep = require('./noarmalize-path-sep');
const ActionExecutor = require('./action-executor').ActionExecutor;
const loadCourseAsset = require('./load-course-asset');
const stepConfigs = require('./config-step');
const { LEVEL_CONFIG_SCHEMA } = require('./level-config-schema');

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
}

exports = module.exports = store;