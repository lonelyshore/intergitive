'use strict'

const yaml = require('js-yaml')
const fs = require('fs-extra')
const path = require('path')
const NestedError = require('nested-error-stacks')

const actionConf = require('./config-action')
const stepConf = require('../src/common/config-step')
const courseConfig = require('../src/common/config-course')
const LEVEL_SCHEMA = require('./level-config-schema').LEVEL_CONFIG_SCHEMA
const ActionExecutor = require('./action-executor').DevActionExecutor

// Previously we have functions to collect sequential levels or levels with prerequisites
// and a function that loads ReferenceMaker mapping for repoVcsSetups
// They were removed because they were not used anymore after commit 82b4c918a04cbe2dfb029928c4ec1c00abad79d1

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
 * @param {string} courseName
 * @param {string} language
 * @param {string} fileSystemBaseFolder
 * @param {string} repoStoreSubPath
 * @param {module:main/load-course-asset~LoaderPair} loaderPair
 */
const run = function (courseName, language, fileSystemBaseFolder, repoStoreSubPath, loaderPair) {
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
