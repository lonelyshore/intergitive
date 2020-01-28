'use strict';

const fs = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');


const paths = require('../../paths');
const courseConfig = require('../../lib/config-course');
const loadCourseAsset = require('../../lib/load-course-asset');
const AssetLoader = require('../../lib/asset-loader').AssetLoader;
const NotFoundError = require('../../lib/asset-loader').NotFoundError;
const CyclicFallbackError = require('../../lib/asset-loader').CyclicFallbackError;
const RuntimeCourseSettings = require('../../lib/runtime-course-settings');

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

describe.only('Prepare to Validate Course Setting', function() {

    let testedCourse;
    let loaderPair;

    before('loads course and levels', function() {
        loaderPair = loadCourseAsset.createCourseAssetLoaderPair(courseSettings);

        return loaderPair.loadCourse(courseSettings.course)
        .then(course => {
            testedCourse = course;
        });
    });

    it('generate validations', function() {

        return Promise.resolve()
        .then(() => {
            validateCourseConfig(courseSettings.course, testedCourse, loaderPair.getCourseLoader(courseSettings.course));
        });
    });

})

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
            let flatCourseConfig = courseConfig.flattenCourseTree(course);

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

            let generateCourseItemValidationVisitor = new courseConfig.CourseItemVisitor(
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
                    checks = checks.then(() => item.accept(generateCourseItemValidationVisitor));
                    return checks;
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

function gatherValidatableLevelList(courseConfig, assetLoader) {

}

function validateLevel(levelConfig, courseAssetLoader) {

}
