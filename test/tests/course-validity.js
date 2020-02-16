'use strict';

const fs = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');


const paths = require('../../paths');
const zip = require('../../lib/simple-archive');
const repoVcs = require('../../lib/repo-vcs');
const configCourse = require('../../lib/config-course');
const configLevel = require('../../lib/config-level');
const loadCourseAsset = require('../../lib/load-course-asset');
const AssetLoader = require('../../lib/asset-loader').AssetLoader;
const configAction = require('../../dev/config-action');
const configStep = require('../../lib/config-step');
const RuntimeCourseSettings = require('../../lib/runtime-course-settings');
const utility = require('../../lib/utility');

const testUtils = require('./test-utils');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

let courseSettings = paths;
if (process.env.COURSE_CONFIG_PATH) {
    let serializedCourseSettings = yaml.safeLoad(
        fs.readFileSync(
            path.join(testUtils.PROJECT_PATH, process.env.COURSE_CONFIG_PATH)
        )
    );

    courseSettings = new RuntimeCourseSettings(
        testUtils.PROJECT_PATH,
        serializedCourseSettings
    );
}

describe('Prepare to Validate Course Setting', function() {

    it('generate validations', function() {
        let validatedCourse;
        let loaderPair = loadCourseAsset.createCourseAssetLoaderPair(courseSettings);
        let courseName = courseSettings.course;

        return loaderPair.loadCourse(courseName)
        .then(course => {
            validatedCourse = course;
        })
        .then(() => {
            validateCourseConfig(courseName, validatedCourse, loaderPair.getCourseLoader(courseName));
        })
        .then(() => {
            return gatherValidatableLevelList(validatedCourse, loaderPair.getCourseLoader(courseName));
        })
        .then(validatedLevels => {

            let loadLevelConfigAndNames = validatedLevels.reduce(
                (loadLevelConfigAndNames, level) => {
                    return loadLevelConfigAndNames.then(levelConfigAndNames => {
                        return loaderPair.loadLevelFromCourse(level.configAssetId, courseName)
                        .then(levelConfig => {
                            levelConfigAndNames.push({ config: levelConfig, name: level.id });
                            return levelConfigAndNames;
                        })
                        .catch(err => {
                            console.error(`Error occured when loading config for ${level.id}`);
                            console.error(err);
                        });
                    });
                },
                Promise.resolve([])
            );

            return loadLevelConfigAndNames.then(levelConfigAndNames => {
                validateLevels(
                    validatedCourse,
                    levelConfigAndNames,
                    loaderPair,
                    courseName
                );
            });
        });
    });
});

/**
 * 
 * @param {string} courseName 
 * @param {courseConfig.Course} course 
 * @param {AssetLoader} assetLoader 
 */
function validateCourseConfig(courseName, course, assetLoader) {

    describe(`Validate course config: ${courseName}`, function() {

        it('validate', function() {
            let errors = [];
            let ids = {};
            let flatCourseConfig = configCourse.flattenCourseTree(course);

            let checkAssetIdExists = (assetId, assetDescription) => {
                return assetLoader.containsAsset(assetId)
                .then(hasAsset => {
                    if (!hasAsset) {
                        errors.push(`[Missing Asset] ${assetDescription}, "${assetId}"`);
                    }
                });
            };

            let collectIdAndCheckUniquness = (id, itemDescription) => {
                if (id in ids) {
                    errors.push(`[Duplicated ID] ${id} of ${itemDescription} duplicated`);
                }
                else {
                    ids[id] = null;
                }
            };

            let checkCourseItemIdExists = (itemId, itemDescription) => {
                if (!(itemId in ids)) {
                    errors.push(`[Missing Course Item] ${id} of ${itemDescription} does not exists in current course ${courseName}`);
                }
            };

            let checkPrerequisitesExist = (courseItem, itemDescription) => {
                courseItem.prerequisiteIds.forEach(prerequisiteId => {
                    checkCourseItemIdExists(prerequisiteId, `prerequisite of ${itemDescription} ${courseItem.id}`);
                })
            }

            let generateCourseItemValidationVisitor = new configCourse.CourseItemVisitor(
                (level) => {
                    return checkAssetIdExists(level.nameKey, `name of level ${level.id}`)
                    .then(() => {
                        return checkAssetIdExists(level.configAssetId, `level config of level ${level.id}`);
                    })
                    .then(() => {
                        collectIdAndCheckUniquness(level.id, `a leve item`);
                    })
                    .then(() => {
                        checkPrerequisitesExist(
                            level,
                            "level item"
                        );
                    });
                },
                (sequentialSection) => {
                    return checkAssetIdExists(sequentialSection.nameKey, `name of sequential section ${sequentialSection.id}`)
                    .then(() => {
                        collectIdAndCheckUniquness(sequentialSection.id, "a sequential section");
                    })
                    .then(() => {
                        checkPrerequisitesExist(
                            sequentialSection,
                            "sequential section"
                        )
                    });
                },
                (freeAccessSection) => {
                    return checkAssetIdExists(freeAccessSection.nameKey, `name of free access section ${freeAccessSection.id}`)
                    .then(() => {
                        collectIdAndCheckUniquness(freeAccessSection.id, "a free access section");
                    })
                    .then(() => {
                        checkPrerequisitesExist(
                            freeAccessSection,
                            "free access section"
                        )
                    })
                },
                (courseItem) => {
                    return checkAssetIdExists(courseItem.nameKey, `name of course ${courseName}`)
                    .then(() => {
                        collectIdAndCheckUniquness(courseItem.id, "course");
                    })
                }
            );

            let checkCourseItems = flatCourseConfig.reduce(
                (checks, item) => {
                    return checks.then(() => item.accept(generateCourseItemValidationVisitor));
                },
                Promise.resolve()
            )
            .then(() => {
                return Promise.resolve(errors).should.eventually
                .has.length(0, `Detect errors: ${errors.join('\n')}`);
            });

            return checkCourseItems;
        })
    })
}

/**
 * 
 * @param {courseConfig.Course} course 
 * @param {AssetLoader} assetLoader 
 */
function gatherValidatableLevelList(course, assetLoader) {
    
    let flatCourseItems = configCourse.flattenCourseTree(course);

    let validLevelFilter = new configCourse.CourseItemVisitor(
        level => {
            return assetLoader.containsAsset(level.configAssetId);
        },
        sequentialSection => false,
        freeAccessSection => false,
        course => false
    );

    return flatCourseItems.filter(item => item.accept(validLevelFilter));
}

/**
 * 
 * @param {courseConfig.Course} course
 * @param {Array<Any>} levelConfigAndNames 
 * @param {loadCourseAsset.LoaderPair} loaderPair 
 * @param {string} courseName 
 */
function validateLevels(course, levelConfigAndNames, loaderPair, courseName) {

    /**
     * 
     * @param {configLevel.Level} levelConfig 
     * @param {string} previousLevelId
     * @param {string} levelName 
     * @param {loadCourseAsset.LoaderPair} loaderPair 
     * @param {string} courseName 
     */
    function validateLevel(levelConfig, previousLevelId, levelName, loaderPair, courseName) {

        describe(`Level ${levelName}`, function() {

            describe('Repo VCS Setup', function() {

                const repoStorePath = path.join(
                    testUtils.PLAYGROUND_PATH,
                    'repo-store'
                );

                class RepoRefDemand {
                    constructor(reference, host) {
                        this.reference = reference;
                        this.host = host;
                    }
                }

                /**
                 * 
                 * @param {string} repoSetupName 
                 * @param {configLevel.RepoVcsSetup} repoSetup 
                 * @param {Array<RepoRefDemand>} repoRefDemands 
                 */
                function validateRepoStore(repoSetupName, repoSetup, repoRefDemands) {

                    let refStoreName = repoSetup.referenceStoreName;

                    if (refStoreName) {

                        it('validate repo store references', function() {
                            let errors = [];
    
                            return fs.emptyDir(repoStorePath)
                            .then(() => {
                                return loaderPair.loadRepoArchivePath(
                                    repoSetup.referenceStoreName,
                                    courseName
                                )
                            })
                            .then(archivePath => {
                                return zip.extractArchiveTo(
                                    archivePath,
                                    path.join(repoStorePath, refStoreName)
                                );
                            })
                            .then(() => {
                                return repoVcs.RepoReferenceManager.create(
                                    '',
                                    repoStorePath,
                                    refStoreName,
                                    repoSetup.repoType,
                                    repoVcs.STORAGE_TYPE.ARCHIVE,
                                    false
                                )
                            })
                            .then(refManager => {
                                let validateRepoReferences = repoRefDemands.reduce(
                                    (validations, repoRefDemand) => {
                                        return validations.then(() => {
                                            return refManager.contains(repoRefDemand.reference)
                                            .then(refExists => {
                                                if (!refExists) {
                                                    errors.push(
                                                        `[Missing Repo Reference] Cannot find reference ${repoRefDemand.reference} from ref store ${repoSetupName}. Required by ${repoRefDemand.host}`
                                                    );
                                                }
                                            });
                                        });
                                    },
                                    Promise.resolve()
                                );

                                return validateRepoReferences;
                            })
                            .catch(err => {
                                errors.push(`Failed to validate ${repoSetupName} because:\n${err}`);
                            })
                            .then(() => {
                                return Promise.resolve(errors)
                                .should.eventually.has.length(0, `Detect errors:\n${errors.join('\n')}`)
                            })
                        });
                    }

                }

                /**
                 * 
                 * @param {configLevel.Level} levelConfig 
                 */
                function collectRepoSetupToDemandedRepoReferenceAndHosts(levelConfig, previousLevelId) {

                    let repoSetupNames = Object.keys(levelConfig.repoVcsSetups);

                    let repoNameToRepoRefDemands = levelConfig.steps.reduce(
                        collectRepoSetupToDemandedRepoReferenceAndHostsFromStep,
                        {}
                    );

                    return repoNameToRepoRefDemands;

                    function collectRepoSetupToDemandedRepoReferenceAndHostsFromStep(repoNameToRepoRefDemands, step) {

                        let repoNameAndRepoRefDemands =
                            extractRepoRefNameAndRepoRefDemandsFromStep(step, repoSetupNames, previousLevelId);

                        repoNameAndRepoRefDemands.forEach(repoNameAndRepoRefDemand => {
                            let repoName = repoNameAndRepoRefDemand.repoName;
                            if (!(repoName in repoNameToRepoRefDemands)) {
                                repoNameToRepoRefDemands[repoName] = [];
                            }
                            repoNameToRepoRefDemands[repoName].push(new RepoRefDemand(
                                repoNameAndRepoRefDemand.referenceName,
                                repoNameAndRepoRefDemand.host
                            ));
                        });

                        return repoNameToRepoRefDemands;

                        function extractRepoRefNameAndRepoRefDemandsFromStep(step, repoSetupNames, previousLevelId) {

                            if (step.actions) {
                                return step.actions.map(extractRepoNameAndRepoRefDemandsFromAction)
                                .filter(obj => obj !== null);
                            }
                            else if (step instanceof configStep.VerifyRepoStep) {
                                return [{
                                    repoName: step.repoSetupName,
                                    referenceName: step.referenceName,
                                    host: '!verifyOneRepo'
                                }];
                            }
                            else if (step instanceof configStep.VerifyAllRepoStep) {
                                return repoSetupNames.map(repoSetupName => {
                                    return {
                                        repoName: repoSetupName,
                                        referenceName: step.referenceName,
                                        host: '!verifyRepo'
                                    };
                                })
                            }
                            else if (step instanceof configStep.LoadReferenceStep) {
                                return [{
                                    repoName: step.repoSetupName,
                                    referenceName: step.referenceName,
                                    host: '!loadReference'
                                }];
                            }
                            else if (step instanceof configStep.LoadLastLevelFinalSnapshotStep) {
                                return step.repoSetupNames.map(repoSetupName => {
                                    return {
                                        repoName: repoSetupName,
                                        referenceName: `${previousLevelId}-final-snapshot`,
                                        host: '!loadLastLevelFinalSnapshot'
                                    };
                                })
                            }
                            else {
                                return [];
                            }

                            function extractRepoNameAndRepoRefDemandsFromAction(action, hostStep) {
                                if (action instanceof configAction.LoadReferenceAction) {
                                    return {
                                        repoName: action.repoSetupName,
                                        referenceName: action.referenceVersionName,
                                        host: `${hostStep}.!act.loadReference`
                                    }
                                }
                                else if (action instanceof configAction.CompareReferenceAction) {
                                    return {
                                        repoName: action.repoSetupName,
                                        referenceName: action.referenceVersionName,
                                        host: `${hostStep}.!act.compareReference`
                                    }
                                }
                                else {
                                    return null;
                                }
                            }
                        }
                    }
                }
                
                let repoNameToRepoRefDemands = collectRepoSetupToDemandedRepoReferenceAndHosts(
                    levelConfig,
                    previousLevelId
                );

                after('Clean Up', function() {
                    return fs.emptyDir(testUtils.PLAYGROUND_PATH);
                });

                it('ensure demanded repo vcs names exists', function() {
                    return Promise.resolve()
                    .then(() => {
                        let invalidRepoNames = 
                        Object.keys(repoNameToRepoRefDemands)
                        .filter(usedRepoName => {
                            return !(usedRepoName in levelConfig.repoVcsSetups);
                        });

                        return invalidRepoNames;
                    })
                    .then(invalidRepoNames => {
                        return Promise.resolve(invalidRepoNames)
                        .should.eventually.has.length(0, `Undefined repo setup names: ${invalidRepoNames.join(', ')}`);
                    });
                    
                });

                Object.keys(repoNameToRepoRefDemands)
                .filter(repoName => repoName in levelConfig.repoVcsSetups)
                .forEach(repoName => {
                    validateRepoStore(
                        repoName,
                        levelConfig.repoVcsSetups[repoName],
                        repoNameToRepoRefDemands[repoName]
                    );
                });
            });

            it('assets should be accessible', function() {

                class AssetDemand {
                    constructor(assetId, host, isText) {
                        this.assetId = assetId;
                        this.host = host;
                        this.isText = isText;
                    }

                    toString() {
                        return `AssetId: ${this.assetId}, Host: ${this.host}`;
                    }
                }

                let errors = [];

                let assetDemands = collectAssetDemandsFromLevel(levelConfig);

                let loader = loaderPair.getCourseLoader(courseName);

                let validateAssetDemands = assetDemands.reduce(
                    (validation, assetDemand) => {
                        return validation.then(() => {
                            return loader.containsAsset(assetDemand.assetId)
                            .then(hasAsset => {
                                if (!hasAsset) {
                                    errors.push(`[Missing Asset] cannot find asset ${assetDemand.assetId} for host ${assetDemand.host}`);
                                }
                                else {
                                    if (assetDemand.isText) {
                                        return loader.loadTextContent(
                                            assetDemand.assetId
                                        )
                                        .then(text => validateTextReplacements(text, assetDemand.host, loader, levelConfig.repoVcsSetups));
                                    }
                                }
                            })
                            .catch(err => {
                                errors.push(`Unexpected error occurs for validating ${assetDemand}:\n${err.stack}`);
                            });
                        })
                    },
                    Promise.resolve()
                );

                return validateAssetDemands
                .then(() => {
                    return Promise.resolve(errors)
                    .should.eventually.has.length(0, errors.join('\n'));
                });

                function collectAssetDemandsFromLevel(levelConfig) {

                    return levelConfig.steps.reduce(
                        (assetDemands, step) => {
                            return assetDemands.concat(collectAssetDemandsFromStep(step));
                        },
                        []
                    );
                    
                    /**
                     * 
                     * @param {configStep.Step} step 
                     * @returns {Array<AssetDemand>}
                     */
                    function collectAssetDemandsFromStep(step) {

                        let results = [];
                        
                        if (step.actions) {
                            results = results.concat(
                                step.actions.reduce(
                                    (demands, action) => {
                                     let newDemends = collectAssetDemandsFromAction(action);
                                        return demands.concat(
                                            newDemends
                                        );
                                    },
                                    results
                                )
                            );
                        }
                        if (step.descriptionId) {
                            results.push(
                                new AssetDemand(
                                    step.descriptionId,
                                    step.klass,
                                    true
                                )
                            );
                        }
                        
                        return results;

                        /**
                         * 
                         * @param {configAction.Action} action 
                         * @returns {Array<AssetDemand>}
                         */
                        function collectAssetDemandsFromAction(action) {
                            if (action instanceof configAction.WriteFileAction) {
                                return action.sourceAssetIds.map(id => {
                                    return new AssetDemand(
                                        id.replace(/^\$/, ''),
                                        '!act.writeFile',
                                        id.startsWith('$')
                                    )
                                });
                            }
                            else if (action instanceof configAction.LoadRepoReferenceArchiveAction) {
                                return [
                                    new AssetDemand(
                                        action.assetId,
                                        '!dev.act.loadRepoReferenceArchive',
                                        false
                                    )
                                ]
                            }
                            else {
                                return [];
                            }
                        }
                    }
                }
                
                /**
                 * 
                 * @param {string} text 
                 * @param {AssetLoader} loader 
                 */
                function validateTextReplacements(text, host, loader, repoSetups) {

                    return utility.searchMustacheReplacementPairs(
                        text,
                        loader
                    )
                    .then(replacements => {
                        let pushErrorWhenNotContainAsset = (replacement) => {
                            return loader.containsAsset(replacement.matchedContent)
                            .then(contains => {
                                if (!contains) {
                                    errors.push(`[Missing Asset] should has ${replacements.matchedContent}, required by ${host}`);
                                }
                            });
                        };

                        let pushErrorWhenNotContainRepoSetup = (replacement) => {
                            return Promise.resolve()
                            .then(() => {
                                if (!(replacement.matchedContent in repoSetups)) {
                                    errors.push(`[Missing Repo Setup] should has ${replacement.matchedContent}, required by ${host}`);
                                }
                            });
                        };

                        return replacements.reduce(
                            (validateReplacingString, replacement) => {
                                return validateReplacingString.then(() => {
                                    return replacement.match(
                                        pushErrorWhenNotContainAsset,
                                        pushErrorWhenNotContainAsset,
                                        pushErrorWhenNotContainRepoSetup
                                    );
                                });
                            },
                            Promise.resolve()
                        );
                    })
                }
            });
        });
    }

    describe(`Validate Levels for Course ${courseName}`, function() {

        let flatCourseItems = configCourse.flattenCourseTree(course);

        levelConfigAndNames.forEach(levelConfigAndName => {
            let lastLevel = configCourse.findLastLevelFromId(flatCourseItems, levelConfigAndName.name);

            validateLevel(
                levelConfigAndName.config,
                lastLevel ? lastLevel.id : '',
                levelConfigAndName.name,
                loaderPair,
                courseName
            );
        })
    })
}
