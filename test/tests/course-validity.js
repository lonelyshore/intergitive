'use strict'

const fs = require('fs-extra')
const path = require('path')

const paths = require('../../paths')
const zip = require('../../src/main/simple-archive')
const repoVcs = require('../../src/main/repo-vcs')
const configCourse = require('../../src/common/config-course')
const loadCourseAsset = require('../../dev/dev-load-course-asset')
const configAction = require('../../dev/config-action')
const configStep = require('../../src/common/config-step')
const loaderUtility = require('../../src/main/loader-utility')
const CourseStruct = require('../../src/main/course-struct')

const testUtils = require('./test-utils')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
chai.should()

let runtimeBasePath = paths.basePath
if (process.env.BASE_PATH) {
  runtimeBasePath = path.isAbsolute(process.env.BASE_PATH)
    ? process.env.BASE_PATH
    : path.join(testUtils.PROJECT_PATH, process.env.BASE_PATH)
}

const courseStruct = new CourseStruct(
  testUtils.PROJECT_PATH,
  path.relative(testUtils.PROJECT_PATH, runtimeBasePath)
)

// loads config from package.json
const skipLevelUntil = process.env.SKIP_UNTIL || null

describe('Prepare to Validate Course Setting', function () {
  it('generate validations', function () {
    const loaderPair = loadCourseAsset.createCourseAssetLoaderPair(courseStruct)

    if (process.env.CORUSE_NAME && process.env.LANGUAGE) {
      return GenerateValidationsForCourseAndLanguage(process.env.CORUSE_NAME, process.env.LANGUAGE, loaderPair)
    } else { // By default this test will validate all accessable courses
      return fs.readdir(courseStruct.courseResourcesPath, { withFileTypes: true })
        .then(dirents => {
          const generateValidations = dirents.reduce(
            (previous, dirent) => {
              if (dirent.isDirectory()) { // is a course folder
                return previous.then(() => {
                  return GenerateValidationForCourse(
                    dirent.name,
                    courseStruct.courseResourcesPath,
                    loaderPair
                  )
                })
              } else {
                return previous
              }
            },
            Promise.resolve()
          )

          return generateValidations
        })
    }
  })

  function GenerateValidationForCourse (courseName, courseResourcesPath, loaderPair) {
    return fs.readdir(path.join(courseResourcesPath, courseName), { withFileTypes: true })
      .then(dirents => {
        const generateValidations = dirents.reduce(
          (previous, dirent) => {
            if (dirent.isDirectory()) { // is a language folder
              return previous.then(() => {
                return GenerateValidationsForCourseAndLanguage(courseName, dirent.name, loaderPair)
              })
            } else {
              return previous
            }
          },
          Promise.resolve()
        )

        return generateValidations
      })
  }

  function GenerateValidationsForCourseAndLanguage (courseName, language, loaderPair) {
    let validatedCourse

    return loaderPair.loadCourse(courseName, language)
      .then(course => {
        validatedCourse = course
      })
      .then(() => {
        validateCourseConfig(courseName, validatedCourse, loaderPair.getCourseLoader(courseName, language))
      })
      .then(() => {
        return gatherValidatableLevelList(validatedCourse, loaderPair.getCourseLoader(courseName, language), skipLevelUntil)
      })
      .then(validatedLevels => {
        const loadLevelConfigAndNames = validatedLevels.reduce(
          (loadLevelConfigAndNames, level) => {
            return loadLevelConfigAndNames.then(levelConfigAndNames => {
              return loaderPair.loadLevelFromCourse(level.configAssetId, courseName, language)
                .then(levelConfig => {
                  levelConfigAndNames.push({ config: levelConfig, name: level.id })
                  return levelConfigAndNames
                })
                .catch(err => {
                  console.error(`Error occured when loading config for ${level.id}`)
                  console.error(err)
                })
            })
          },
          Promise.resolve([])
        )

        return loadLevelConfigAndNames.then(levelConfigAndNames => {
          validateLevels(
            validatedCourse,
            levelConfigAndNames,
            loaderPair,
            courseName,
            language
          )
        })
      })
  }
})

/**
 *
 * @param {string} courseName
 * @param {courseConfig.Course} course
 * @param {module:main/asset-loader~AssetLoader} assetLoader
 */
function validateCourseConfig (courseName, course, assetLoader) {
  describe(`Validate course config: ${courseName}`, function () {
    it('validate', function () {
      const errors = []
      const ids = {}
      const flatCourseConfig = configCourse.flattenCourseTree(course)

      const checkAssetIdExists = (assetId, assetDescription) => {
        return assetLoader.containsAsset(assetId)
          .then(hasAsset => {
            if (!hasAsset) {
              errors.push(`[Missing Asset] ${assetDescription}, "${assetId}"`)
            }
          })
      }

      const collectIdAndCheckUniquness = (id, itemDescription) => {
        if (id in ids) {
          errors.push(`[Duplicated ID] ${id} of ${itemDescription} duplicated`)
        } else {
          ids[id] = null
        }
      }

      const checkCourseItemIdExists = (itemId, itemDescription) => {
        if (!(itemId in ids)) {
          errors.push(`[Missing Course Item] ${itemId} of ${itemDescription} does not exists in current course ${courseName}`)
        }
      }

      const checkPrerequisitesExist = (courseItem, itemDescription) => {
        courseItem.prerequisiteIds.forEach(prerequisiteId => {
          checkCourseItemIdExists(prerequisiteId, `prerequisite of ${itemDescription} ${courseItem.id}`)
        })
      }

      const generateCourseItemValidationVisitor = new configCourse.CourseItemVisitor(
        (level) => {
          return checkAssetIdExists(level.nameKey, `name of level ${level.id}`)
            .then(() => {
              return checkAssetIdExists(level.configAssetId, `level config of level ${level.id}`)
            })
            .then(() => {
              collectIdAndCheckUniquness(level.id, 'a leve item')
            })
            .then(() => {
              checkPrerequisitesExist(
                level,
                'level item'
              )
            })
        },
        (sequentialSection) => {
          return checkAssetIdExists(sequentialSection.nameKey, `name of sequential section ${sequentialSection.id}`)
            .then(() => {
              collectIdAndCheckUniquness(sequentialSection.id, 'a sequential section')
            })
            .then(() => {
              checkPrerequisitesExist(
                sequentialSection,
                'sequential section'
              )
            })
        },
        (freeAccessSection) => {
          return checkAssetIdExists(freeAccessSection.nameKey, `name of free access section ${freeAccessSection.id}`)
            .then(() => {
              collectIdAndCheckUniquness(freeAccessSection.id, 'a free access section')
            })
            .then(() => {
              checkPrerequisitesExist(
                freeAccessSection,
                'free access section'
              )
            })
        },
        (courseItem) => {
          return checkAssetIdExists(courseItem.nameKey, `name of course ${courseName}`)
            .then(() => {
              collectIdAndCheckUniquness(courseItem.id, 'course')
            })
        }
      )

      const checkCourseItems = flatCourseConfig.reduce(
        (checks, item) => {
          return checks.then(() => item.accept(generateCourseItemValidationVisitor))
        },
        Promise.resolve()
      )
        .then(() => {
          return Promise.resolve(errors).should.eventually
            .has.length(0, `Detect errors: ${errors.join('\n')}`)
        })

      return checkCourseItems
    })
  })
}

/**
 *
 * @param {courseConfig.Course} course
 * @param {module:main/asset-loader~AssetLoader} assetLoader
 * @param {string} skipUntil
 */
function gatherValidatableLevelList (course, assetLoader, skipUntil) {
  const flatCourseItems = configCourse.flattenCourseTree(course)

  const validLevelFilter = new configCourse.CourseItemVisitor(
    level => {
      return assetLoader.containsAsset(level.configAssetId)
    },
    sequentialSection => false,
    freeAccessSection => false,
    course => false
  )

  let canTake = skipUntil === null

  const notSkippedFunc = (item) => {
    if (!canTake) {
      canTake = item.id === skipUntil // try toggle canTake when it still cannot
    }

    return canTake
  }

  return flatCourseItems.filter(item => notSkippedFunc(item) && item.accept(validLevelFilter))
}

/**
 *
 * @param {courseConfig.Course} course
 * @param {Array<Any>} levelConfigAndNames
 * @param {loadCourseAsset.LoaderPair} loaderPair
 * @param {string} courseName
 */
function validateLevels (course, levelConfigAndNames, loaderPair, courseName, language) {
  /**
     *
     * @param {module:common/config-level~Level} levelConfig
     * @param {string} previousLevelId
     * @param {string} levelName
     * @param {loadCourseAsset.LoaderPair} loaderPair
     * @param {string} courseName
     */
  function validateLevel (levelConfig, previousLevelId, levelName, loaderPair, courseName, language) {
    describe(`Level ${levelName} in ${language}`, function () {
      describe('Repo VCS Setup', function () {
        const repoStorePath = path.join(
          testUtils.PLAYGROUND_PATH,
          'repo-store'
        )

        class RepoRefDemand {
          constructor (reference, host) {
            this.reference = reference
            this.host = host
          }
        }

        /**
        *
        * @param {string} repoSetupName
        * @param {module:common/config-level~RepoVcsSetup} repoSetup
        * @param {Array<RepoRefDemand>} repoRefDemands
        */
        function validateRepoStore (repoSetupName, repoSetup, repoRefDemands) {
          const refStoreName = repoSetup.referenceStoreName

          if (refStoreName) {
            it('validate repo store references', function () {
              const errors = []

              return fs.emptyDir(repoStorePath)
                .then(() => {
                  return loaderPair.loadRepoArchivePath(
                    repoSetup.referenceStoreName,
                    courseName,
                    language
                  )
                })
                .then(archivePath => {
                  return zip.extractArchiveTo(
                    archivePath,
                    path.join(repoStorePath, refStoreName)
                  )
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
                  const validateRepoReferences = repoRefDemands.reduce(
                    (validations, repoRefDemand) => {
                      return validations.then(() => {
                        return refManager.contains(repoRefDemand.reference)
                          .then(refExists => {
                            if (!refExists) {
                              errors.push(
                                `[Missing Repo Reference] Cannot find reference ${repoRefDemand.reference} from ref store ${repoSetupName}. Required by ${repoRefDemand.host}`
                              )
                            }
                          })
                      })
                    },
                    Promise.resolve()
                  )

                  return validateRepoReferences
                })
                .catch(err => {
                  errors.push(`Failed to validate ${repoSetupName} because:\n${err}\nstack:${err.stack}`)
                })
                .then(() => {
                  return Promise.resolve(errors)
                    .should.eventually.has.length(0, `Detect errors:\n${errors.join('\n')}`)
                })
            })
          }
        }

        /**
        *
        * @param {module:common/config-level~Level} levelConfig
        */
        function collectRepoSetupToDemandedRepoReferenceAndHosts (levelConfig, previousLevelId) {
          const repoSetupNames = Object.keys(levelConfig.repoVcsSetups)

          const repoNameToRepoRefDemands = levelConfig.steps.reduce(
            collectRepoSetupToDemandedRepoReferenceAndHostsFromStep,
            {}
          )

          return repoNameToRepoRefDemands

          function collectRepoSetupToDemandedRepoReferenceAndHostsFromStep (repoNameToRepoRefDemands, step) {
            const repoNameAndRepoRefDemands =
                            extractRepoRefNameAndRepoRefDemandsFromStep(step, repoSetupNames, previousLevelId)

            repoNameAndRepoRefDemands.forEach(repoNameAndRepoRefDemand => {
              const repoName = repoNameAndRepoRefDemand.repoName
              if (!(repoName in repoNameToRepoRefDemands)) {
                repoNameToRepoRefDemands[repoName] = []
              }
              repoNameToRepoRefDemands[repoName].push(new RepoRefDemand(
                repoNameAndRepoRefDemand.referenceName,
                repoNameAndRepoRefDemand.host
              ))
            })

            return repoNameToRepoRefDemands

            function extractRepoRefNameAndRepoRefDemandsFromStep (step, repoSetupNames, previousLevelId) {
              if (step.actions) {
                return step.actions.map(extractRepoNameAndRepoRefDemandsFromAction)
                  .filter(obj => obj !== null)
              } else if (step instanceof configStep.VerifyRepoStep) {
                return [{
                  repoName: step.repoSetupName,
                  referenceName: step.referenceName,
                  host: '!verifyOneRepo'
                }]
              } else if (step instanceof configStep.VerifyAllRepoStep) {
                return repoSetupNames.map(repoSetupName => {
                  return {
                    repoName: repoSetupName,
                    referenceName: step.referenceName,
                    host: '!verifyRepo'
                  }
                })
              } else if (step instanceof configStep.LoadReferenceStep) {
                return [{
                  repoName: step.repoSetupName,
                  referenceName: step.referenceName,
                  host: '!loadOneReference'
                }]
              } else if (step instanceof configStep.LoadReferenceStep) {
                return repoSetupNames.map(repoSetupName => {
                  return {
                    repoName: repoSetupName,
                    referenceName: step.referenceName,
                    host: '!loadReference'
                  }
                })
              } else if (step instanceof configStep.LoadLastLevelFinalSnapshotStep) {
                const loadedRepoSetupNames =
                                    step.repoSetupNames || repoSetupNames
                return loadedRepoSetupNames.map(repoSetupName => {
                  return {
                    repoName: repoSetupName,
                    referenceName: `${previousLevelId}-final-snapshot`,
                    host: '!loadLastLevelFinalSnapshot'
                  }
                })
              } else {
                return []
              }

              function extractRepoNameAndRepoRefDemandsFromAction (action, hostStep) {
                if (action instanceof configAction.LoadReferenceAction) {
                  return {
                    repoName: action.repoSetupName,
                    referenceName: action.referenceName,
                    host: `${hostStep}.!act.loadReference`
                  }
                } else if (action instanceof configAction.CompareReferenceAction) {
                  return {
                    repoName: action.repoSetupName,
                    referenceName: action.referenceName,
                    host: `${hostStep}.!act.compareReference`
                  }
                } else {
                  return null
                }
              }
            }
          }
        }

        const repoNameToRepoRefDemands = collectRepoSetupToDemandedRepoReferenceAndHosts(
          levelConfig,
          previousLevelId
        )

        after('Clean Up', function () {
          return fs.emptyDir(testUtils.PLAYGROUND_PATH)
        })

        it('ensure demanded repo vcs names exists', function () {
          return Promise.resolve()
            .then(() => {
              const invalidRepoNames =
                        Object.keys(repoNameToRepoRefDemands)
                          .filter(usedRepoName => {
                            return !(usedRepoName in levelConfig.repoVcsSetups)
                          })

              return invalidRepoNames
            })
            .then(invalidRepoNames => {
              return Promise.resolve(invalidRepoNames)
                .should.eventually.has.length(0, `Undefined repo setup names: ${invalidRepoNames.join(', ')}`)
            })
        })

        Object.keys(repoNameToRepoRefDemands)
          .filter(repoName => repoName in levelConfig.repoVcsSetups)
          .forEach(repoName => {
            validateRepoStore(
              repoName,
              levelConfig.repoVcsSetups[repoName],
              repoNameToRepoRefDemands[repoName]
            )
          })
      })

      it('assets should be accessible', function () {
        class AssetDemand {
          constructor (assetId, host, isText) {
            this.assetId = assetId
            this.host = host
            this.isText = isText
          }

          toString () {
            return `AssetId: ${this.assetId}, Host: ${this.host}`
          }
        }

        const errors = []

        const assetDemands = collectAssetDemandsFromLevel(levelConfig)

        const loader = loaderPair.getCourseLoader(courseName, language)

        const validateAssetDemands = assetDemands.reduce(
          (validation, assetDemand) => {
            return validation.then(() => {
              return loader.containsAsset(assetDemand.assetId)
                .then(hasAsset => {
                  if (!hasAsset) {
                    errors.push(`[Missing Asset] cannot find asset ${assetDemand.assetId} for host ${assetDemand.host}`)
                  } else {
                    if (assetDemand.isText) {
                      return loader.loadTextContent(
                        assetDemand.assetId
                      )
                        .then(text => validateTextReplacements(text, assetDemand.host, loader, levelConfig.repoVcsSetups))
                    } else {
                      return loader.getFullAssetPath(assetDemand.assetId)
                        .then(fullAssetPath => {
                          return fs.access(fullAssetPath)
                            .catch(() => {
                              errors.push(`Cannot access asset given id ${assetDemand.assetId} for host ${assetDemand.host}; fail to access it at path ${fullAssetPath}`)
                            })
                        })
                    }
                  }
                })
                .catch(err => {
                  errors.push(`Unexpected error occurs for validating ${assetDemand}:\n${err.stack}`)
                })
            })
          },
          Promise.resolve()
        )

        return validateAssetDemands
          .then(() => {
            return Promise.resolve(errors)
              .should.eventually.has.length(0, errors.join('\n'))
          })

        function collectAssetDemandsFromLevel (levelConfig) {
          return levelConfig.steps.reduce(
            (assetDemands, step) => {
              return assetDemands.concat(collectAssetDemandsFromStep(step))
            },
            []
          )

          /**
                     *
                     * @param {configStep.Step} step
                     * @returns {Array<AssetDemand>}
                     */
          function collectAssetDemandsFromStep (step) {
            let results = []

            if (step.actions) {
              results = results.concat(
                step.actions.reduce(
                  (demands, action) => {
                    const newDemends = collectAssetDemandsFromAction(action)
                    return demands.concat(
                      newDemends
                    )
                  },
                  results
                )
              )
            }
            if (step.descriptionId) {
              results.push(
                new AssetDemand(
                  step.descriptionId,
                  step.klass,
                  true
                )
              )
            }

            return results

            /**
                         *
                         * @param {configAction.Action} action
                         * @returns {Array<AssetDemand>}
                         */
            function collectAssetDemandsFromAction (action) {
              if ('sourceAssetIds' in action) {
                return action.sourceAssetIds.map(id => {
                  return new AssetDemand(
                    id.replace(/^\$/, ''),
                    action.klass,
                    id.startsWith('$')
                  )
                })
              } else if ('arguments' in action) {
                return action.arguments.filter(argument => argument.startsWith('$'))
                  .map(argument => {
                    return new AssetDemand(
                      argument.replace(/^\$/, ''),
                      action.klass,
                      true
                    )
                  })
              } else if (action instanceof configAction.LoadRepoReferenceArchiveAction) {
                return [
                  new AssetDemand(
                    action.assetId,
                    '!dev.act.loadRepoReferenceArchive',
                    false
                  )
                ]
              } else {
                return []
              }
            }
          }
        }

        /**
                 *
                 * @param {string} text
                 * @param {module:main/asset-loader~AssetLoader} loader
                 */
        function validateTextReplacements (text, host, loader, repoSetups) {
          return loaderUtility.searchMustacheReplacementPairs(
            text,
            loader
          )
            .then(replacements => {
              const pushErrorWhenNotContainAsset = (replacement) => {
                return loader.containsAsset(replacement.matchedContent)
                  .then(contains => {
                    if (!contains) {
                      errors.push(`[Missing Matching] should has ${replacement.matchedContent}, required by ${host}`)
                    }
                  })
              }

              const pushErrorWhenNotContainRepoSetup = (replacement) => {
                return Promise.resolve()
                  .then(() => {
                    if (!(replacement.matchedContent in repoSetups)) {
                      errors.push(`[Missing Repo Setup] should has ${replacement.matchedContent}, required by ${host}`)
                    }
                  })
              }

              return replacements.reduce(
                (validateReplacingString, replacement) => {
                  return validateReplacingString.then(() => {
                    return replacement.match(
                      pushErrorWhenNotContainAsset,
                      pushErrorWhenNotContainAsset,
                      pushErrorWhenNotContainRepoSetup,
                      pushErrorWhenNotContainRepoSetup
                    )
                  })
                },
                Promise.resolve()
              )
            })
        }
      })
    })
  }

  describe(`Validate Levels for Course ${courseName} and Language ${language}`, function () {
    const flatCourseItems = configCourse.flattenCourseTree(course)

    levelConfigAndNames.forEach(levelConfigAndName => {
      const lastLevel = configCourse.findLastLevelFromId(flatCourseItems, levelConfigAndName.name)

      validateLevel(
        levelConfigAndName.config,
        lastLevel ? lastLevel.id : '',
        levelConfigAndName.name,
        loaderPair,
        courseName,
        language
      )
    })
  })
}
