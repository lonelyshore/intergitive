"use strict";

const yaml = require("js-yaml");
const fs = require("fs-extra");

const actionConf = require("./config-action");
const stepConf = require("../lib/config-step");
const courseConfig = require("../lib/config-course");
const vcs = require("../lib/repo-vcs");
const devParams = require('./parameters');
const LEVEL_SCHEMA = require("../lib/level-config-schema").LEVEL_CONFIG_SCHEMA;
const COURSE_SCHEMA = require("../lib/course-config-schema").COURSE_CONFIG_SCHEMA;
const REPO_TYPE = require('../lib/config-level').REPO_TYPE;
const ActionExecutor = require("../lib/action-executor").ActionExecutor;
const Level = require("../lib/config-level").Level;

/**
 * 
 * @param {string} configPath 
 */
const loadCourse = function(configPath, schema) {
    return fs.readFile(configPath)
    .then(content => {
        return yaml.safeLoad(content, {
            schema: schema
        });
    });
}

const loadReferenceMakerMapping = function(repoVcsSetups, storePath) {

    let referenceMakerMapping = {};

    let loadReferenceMakers =
        Object.keys(repoVcsSetups).map(key => {
            let setup = repoVcsSetups[key];
            return vcs.RepoReferenceMaker.create(
                setup.workingPath,
                storePath,
                setup.referenceStoreName,
                setup.repoType === REPO_TYPE.REMOTE,
                devParams.defaultRepoStorageType
            )
            .then(maker => {
                referenceMakerMapping[key] = maker;
            });
        });

    return Promise.all(loadReferenceMakers).then(() => {
        return referenceMakerMapping;
    });
}

/**
 * 
 * @param {Level} level
 * @param {String} levelId
 * @param {Object} courseItemDict
 * @param {Array<String>} flatCourseIds
 * @param {Object} actionExecutorContext
 */
const bakeLevel = function(level, levelId, flatCourseIds, courseItemDict, actionExecutorContext) {

    let actionExecutor = new ActionExecutor(
        actionExecutorContext.fileSystemBaseFolder,
        actionExecutorContext.repoStoreSubPath,
        actionExecutorContext.assetLoader,
        level.repoVcsSetups
    );

    let repoVcsSetupNames = Object.keys(level.repoVcsSetups);

    let promises = Promise.resolve();

    level.steps.forEach((step) => {
        if ('actions' in step) {
            step.actions.forEach(action => {
                promises = promises.then(() => {
                    return action.evaluate(actionExecutor);
                });
            });
        }
        else if (step instanceof stepConf.VerifyRepoStep) {
            promises = promises.then(() => {
                let saveRefAction = new actionConf.SaveRepoReferenceAction(
                    step.repoSetupName,
                    step.referenceName
                );

                return saveRefAction.executeBy(actionExecutor);
            });
        }
        else if (step instanceof stepConf.LoadLastStageFinalSnapshotStep) {
            
            let previousLevelId = null;
            for (let i = flatCourseIds.indexOf(levelId) - 1; i >= 0; i--) {
                let candidateLevelId = flatCourseIds[levelId];
                if (courseItemDict[candidateLevelId] instanceof courseConfig.LevelItem) {
                    previousLevelId = candidateLevelId;
                    break;
                }
            }

            let loadRefActions = repoVcsSetupNames.map(repoVcsSetupName => {
                return new actionConf.LoadReferenceAction(
                    repoVcsSetupName,
                    `${previousLevelId}-final-snapshot`
                )
            });

            loadRefActions.forEach(action => {
                promises = promises.then(() => {
                    return action.executeBy(actionExecutor);
                })
            });
        }
    });

    let saveFinalSnapshotActions = repoVcsSetupNames.map(repoVcsSetupName => {
        return new actionConf.SaveRepoReferenceAction(
            repoVcsSetupName,
            `${levelId}-final-snapshot`
        );
    });

    saveFinalSnapshotActions.forEach(action => {
        promises = promises.then(() => {
            return action.executeBy(actionExecutor);
        })
    })

    return promises;
}

/**
 * 
 * @param {courseConfig.SectionItem} course
 * @returns {Array<courseConfig.LevelItem>}
 */
const collectSequentialLevels = function(course) {
    let collected = [];

    course.sequentialChildren.forEach(item => {
        if (item instanceof courseConfig.LevelItem) {
            collected.push(item);
        }
        else {
            collected.concat(collectSequentialLevels(item));
        }
    });

    return collected;
}

/**
 * 
 * @param {courseConfig.SectionItem} course
 * @returns {Array<courseConfig.LevelItem>}
 */
const collectHasPrerequisiteLevels = function(course) {
    let collected = [];
    let stack = [];
    stack.push(course);

    while (stack.length != 0) {
        let current = stack.pop();
        current.hasPrerequisiteChildren.forEach(item => {
            let internal = item.wrappedItem;
            if (internal instanceof courseConfig.LevelItem) {
                collected.push(internal);
            }
            else {
                stack.push(internal);
            }
        });
    }

    return collected;
}

/**
 * Flatten course tree
 * @param {courseConfig.NamedCourseItem} item 
 * @param {Array<string>} flatCourseSeries
 */
function flattenCourseTree(item, flatCourseSeries) {
    if ('children' in item) {
        item.children.forEach(child => {
            flattenCourseTree(child, flatCourseSeries);
        });
    }
    
    flatCourseSeries.push(item.id);
}

function CollectCourseItemIdToItemDict(course) {
    let dict = {};

    let stack = [course];
    while (stack.length !== 0) {

        let current = stack.pop();
        dict[current.id] = current;

        if ('children' in current) {
            stack = stack.concat(current.children);
        }
    }

    return dict;
}

/**
 * 
 * @param {string} configPath 
 */
const run = function(configPath, fileSystemBaseFolder, repoStoreSubPath, assetLoader) {

    const actionExecutorContext = {
        fileSystemBaseFolder: fileSystemBaseFolder,
        repoStoreSubPath: repoStoreSubPath,
        assetLoader: assetLoader
    };

    let course;
    
    return loadCourse(configPath, COURSE_SCHEMA)
    .then(result => {
        course = result;
    })
    .then(() => {
        let flatCourseIds = [];
        flattenCourseTree(course, flatCourseIds);

        return flatCourseIds;
    })
    .then(flatCourseIds => {
        let idToItemDict = CollectCourseItemIdToItemDict(course);

        let bakeLevelTasks = Promise.resolve();
        flatCourseIds.forEach(courseItemId => {
            let item = idToItemDict[courseItemId];

            if (item instanceof courseConfig.LevelItem) {
                bakeLevelTasks = bakeLevelTasks.then(() => {
                    return bakeLevel(
                        item,
                        courseItemId,
                        flatCourseIds,
                        idToItemDict,
                        actionExecutorContext,
                    );
                });
            }
        });

        return bakeLevelTasks;
    })
}
