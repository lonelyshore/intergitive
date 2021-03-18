'use strict'

const yaml = require('js-yaml')
const fs = require('fs-extra')
const path = require('path')
const NestedError = require('nested-error-stacks')

const actionConf = require('./config-action')
const stepConf = require('../src/common/config-step')
const courseConfig = require('../src/common/config-course')
const vcs = require('../src/main/repo-vcs')
const devParams = require('./parameters')
const loadCourseAsset = require('../src/main/load-course-asset')
const LEVEL_SCHEMA = require('./level-config-schema').LEVEL_CONFIG_SCHEMA
const COURSE_SCHEMA = require('../src/common/course-config-schema').COURSE_CONFIG_SCHEMA
const REPO_TYPE = require('../src/common/config-level').REPO_TYPE
const ActionExecutor = require('./action-executor').DevActionExecutor
const Level = require('../src/common/config-level').Level

const loadReferenceMakerMapping = function (repoVcsSetups, storePath) {
  const referenceMakerMapping = {}

  const loadReferenceMakers =
        Object.keys(repoVcsSetups).map(key => {
          const setup = repoVcsSetups[key]
          return vcs.RepoReferenceMaker.create(
            setup.workingPath,
            storePath,
            setup.referenceStoreName,
            setup.repoType === REPO_TYPE.REMOTE,
            devParams.defaultRepoStorageType
          )
            .then(maker => {
              referenceMakerMapping[key] = maker
            })
        })

  return Promise.all(loadReferenceMakers).then(() => {
    return referenceMakerMapping
  })
}

/**
 *
 * @param {courseConfig.LevelItem} levelItem
 * @param {Array<String>} flatCourseIds
 * @param {Object} actionExecutorContext
 */
const bakeLevel = function (levelItem, flatCourseItems, actionExecutorContext) {
  console.log(`baking ${levelItem.id}`)

  return actionExecutorContext.assetLoader.loadTextContent(levelItem.configAssetId)
    .then(text => {
      return yaml.safeLoad(text, { schema: LEVEL_SCHEMA })
    })
    .catch(error => {
      throw new NestedError(`Failed to load level ${levelItem.id}`, error)
    })
    .then(level => {
      let bakeActions = initilaizeRepoVcsSetup(
        actionExecutorContext.fileSystemBaseFolder,
        actionExecutorContext.repoStoreSubPath,
        level.repoVcsSetups
      )

      const actionExecutor = new ActionExecutor(
        actionExecutorContext.fileSystemBaseFolder,
        actionExecutorContext.repoStoreSubPath,
        actionExecutorContext.assetLoader,
        level.repoVcsSetups
      )

      const repoVcsSetupNames = Object.keys(level.repoVcsSetups)

      level.steps.forEach((step, stepIndex) => {
        if ('actions' in step) {
          if (!step.actions.forEach) {
            throw new Error(`step-#${stepIndex} ${step.klass} does not contain actions as an array`)
          }

          step.actions.forEach(action => {
            bakeActions = bakeActions.then(() => {
              return action.executeBy(actionExecutor)
                .catch(e => {
                  throw new NestedError(`failed to execute action for ${action.klass} in step-#${stepIndex} ${step.klass}`, e)
                })
            })
          })
        } else if (step instanceof stepConf.VerifyRepoStep) {
          bakeActions = bakeActions.then(() => {
            const saveRefAction = new actionConf.SaveRepoReferenceAction(
              step.repoSetupName,
              step.referenceName
            )

            return saveRefAction.executeBy(actionExecutor)
          })
        } else if (step instanceof stepConf.VerifyAllRepoStep) {
          repoVcsSetupNames.forEach(repoVcsSetupName => {
            bakeActions = bakeActions.then(() => {
              const saveRefAction = new actionConf.SaveRepoReferenceAction(
                repoVcsSetupName,
                step.referenceName
              )

              return saveRefAction.executeBy(actionExecutor)
            })
          })
        } else if (step instanceof stepConf.LoadAllReferenceStep) {
          repoVcsSetupNames.forEach(repoVcsSetupName => {
            bakeActions = bakeActions.then(() => {
              const loadRefAction = new actionConf.LoadReferenceAction(
                repoVcsSetupName,
                step.referenceName
              )

              return loadRefAction.executeBy(actionExecutor)
            })
          })
        } else if (step instanceof stepConf.LoadLastLevelFinalSnapshotStep) {
          const previousLevel = courseConfig.findLastLevel(flatCourseItems, levelItem)
          const previousLevelId = previousLevel ? previousLevel.id : null

          const loadedRepoSetupNames =
                    step.repoSetupNames || repoVcsSetupNames

          const loadRefActions = loadedRepoSetupNames.map(repoVcsSetupName => {
            return new actionConf.LoadReferenceAction(
              repoVcsSetupName,
                        `${previousLevelId}-final-snapshot`
            )
          })

          loadRefActions.forEach(action => {
            bakeActions = bakeActions.then(() => {
              return action.executeBy(actionExecutor)
            })
          })
        }
      })

      const saveFinalSnapshotActions = repoVcsSetupNames.map(repoVcsSetupName => {
        return new actionConf.SaveRepoReferenceAction(
          repoVcsSetupName,
                `${levelItem.id}-final-snapshot`
        )
      })

      saveFinalSnapshotActions.forEach(action => {
        bakeActions = bakeActions.then(() => {
          return action.executeBy(actionExecutor)
        })
      })

      return bakeActions
    })
    .catch(error => {
      throw new NestedError(`Failed to execute actions for level ${levelItem.id}`, error)
    })

  function initilaizeRepoVcsSetup (fileSystemBaseFolder, repoStoreSubPath, repoVcsSetups) {
    return Object.keys(repoVcsSetups).reduce(
      (initializationPromise, repoSetupName) => {
        return initializationPromise.then(() => {
          const setup = repoVcsSetups[repoSetupName]
          return fs.emptyDir(path.join(fileSystemBaseFolder, setup.workingPath))
            .then(() => {
              return fs.ensureDir(path.join(fileSystemBaseFolder, repoStoreSubPath, setup.referenceStoreName))
            })
        })
      },
      Promise.resolve()
    )
  }
}

/**
 *
 * @param {courseConfig.SectionItem} course
 * @returns {Array<courseConfig.LevelItem>}
 */
const collectSequentialLevels = function (course) {
  const collected = []

  course.sequentialChildren.forEach(item => {
    if (item instanceof courseConfig.LevelItem) {
      collected.push(item)
    } else {
      collected.concat(collectSequentialLevels(item))
    }
  })

  return collected
}

/**
 *
 * @param {courseConfig.SectionItem} course
 * @returns {Array<courseConfig.LevelItem>}
 */
const collectHasPrerequisiteLevels = function (course) {
  const collected = []
  const stack = []
  stack.push(course)

  while (stack.length != 0) {
    const current = stack.pop()
    current.hasPrerequisiteChildren.forEach(item => {
      const internal = item.wrappedItem
      if (internal instanceof courseConfig.LevelItem) {
        collected.push(internal)
      } else {
        stack.push(internal)
      }
    })
  }

  return collected
}

function CollectCourseItemIdToItemDict (course) {
  const dict = {}

  let stack = [course]
  while (stack.length !== 0) {
    const current = stack.pop()
    dict[current.id] = current

    if ('children' in current) {
      stack = stack.concat(current.children)
    }
  }

  return dict
}

/**
 *
 * @param {string} courseName
 * @param {string} language
 * @param {string} fileSystemBaseFolder
 * @param {string} repoStoreSubPath
 * @param {loadCourseAsset.LoaderPair} loaderPair
 */
const run = function (courseName, fileSystemBaseFolder, repoStoreSubPath, loaderPair) {
  const actionExecutorContext = {
    fileSystemBaseFolder: fileSystemBaseFolder,
    repoStoreSubPath: repoStoreSubPath,
    assetLoader: loaderPair.getCourseLoader(courseName)
  }

  // loads config from package.json
  const skipLevelUntil = process.env.SKIP_UNTIL || null
  console.log(
    skipLevelUntil === null
      ? '* Will bake all levels'
      : `* Skipping until "${skipLevelUntil}". Please be sure it is level.Id`
  )

  let course

  return loaderPair.loadCourse(courseName, language)
    .then(result => {
      course = result
    })
    .then(() => {
      let isSkipping = skipLevelUntil !== null
      const isSkippedCb = (item) => {
        if (isSkipping) {
          isSkipping = item.id !== skipLevelUntil
        }
        return isSkipping
      }
      return courseConfig.flattenCourseTree(course)
        .filter(item => !isSkippedCb(item))
    })
    .then(flatCourseItems => {
      let bakeLevelTasks = Promise.resolve()
      flatCourseItems.forEach(item => {
        if (item instanceof courseConfig.LevelItem) {
          bakeLevelTasks = bakeLevelTasks.then(() => {
            return bakeLevel(
              item,
              flatCourseItems,
              actionExecutorContext
            )
          })
        }
      })

      return bakeLevelTasks
    })
}

module.exports.run = run
