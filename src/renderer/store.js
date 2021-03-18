'use strict'

const yaml = require('js-yaml')
const marked = require('marked')

const { ProgressEnum } = require('../common/progress')
const { ProgressManager, ProgressInfo } = require('./progress-manager')
const { assert } = require('../common/utility')

const dependencies = window.dependencies
const stepConfigs = require('../common//config-step')
const actionConfigs = require('../common/config-action')
const courseConfig = require('../common/config-course')
const { LEVEL_CONFIG_SCHEMA } = require('../common/level-config-schema')
const { COURSE_CONFIG_SCHEMA } = require('../common/course-config-schema')

const ProcessState = stepConfigs.ProcessState

const api = window.api
const dialog = window.electronRemote.dialog

function invokeExecute (action) {
  return api.invokeExecute(yaml.dump(action, { schema: LEVEL_CONFIG_SCHEMA }))
}

function loadLevelSteps (steps) {
  const renderStepsBuffer = []
  const stepStatesBuffer = {}
  const blockingStepsBuffer = []
  const needProcessStepsBuffer = []

  steps.forEach((step, index) => {
    const indexString = `${index}`

    if (step.componentType) {
      renderStepsBuffer.push(indexString)
    }

    if (step.isBlocking) {
      blockingStepsBuffer.push(index)
    }

    if (step.needProcess) {
      needProcessStepsBuffer.push(index)
    }

    const initialState = step.createInitialState()

    stepStatesBuffer[indexString] = {
      step: step,
      state: initialState,
      deepCloneInto: step.deepCloneInto
    }
  })

  this.levelState.renderSteps = renderStepsBuffer
  this.levelState.stepStates = stepStatesBuffer
  this.levelState.blockingSteps = blockingStepsBuffer
  this.levelState.needProcessSteps = needProcessStepsBuffer

  // Process blocking issue
  this.levelState.currentBlockingStep =
        this.levelState.blockingSteps.length !== 0
          ? this.levelState.blockingSteps[0]
          : steps.length

  this.levelState.minProcessingStep = 0

  this.updateBlockingStates()

  this.levelState.stepsReady = true
  this.levelState.interactable = true
}

function executeActionsSequentially (actions) {
  let thread = Promise.resolve()

  actions.forEach(action => {
    thread = thread.then(() => {
      return invokeExecute(action)
    })
  })

  return thread
}

function assembleLoadReferenceActions (repoSetupNames, referenceName) {
  const actions = []
  repoSetupNames.forEach(repoSetupName => {
    const action = new actionConfigs.LoadReferenceAction(
      repoSetupName,
      referenceName
    )

    actions.push(action)
  })

  return actions
}

function getRepoSetupNamesForStep (step) {
  if (step instanceof stepConfigs.VerifyRepoStep) {
    return [step.repoSetupName]
  } else if (step instanceof stepConfigs.LoadReferenceStep) {
    return [step.repoSetupName]
  } else if (step instanceof stepConfigs.VerifyAllRepoStep) {
    return this.levelState.repoSetupNames
  } else if (step instanceof stepConfigs.LoadAllReferenceStep) {
    return this.levelState.repoSetupNames
  } else if (step instanceof stepConfigs.LoadLastLevelFinalSnapshotStep) {
    return step.repoSetupNames || this.levelState.repoSetupNames
  }
}

class StoreStateCheckpoint {
  constructor (state) {
    this.clonedStepStates = {}

    Object.keys(state.stepStates).forEach(key => {
      const clonedStepState = {}
      const stepState = state.stepStates[key]

      stepState.deepCloneInto(stepState.state, clonedStepState)
      this.clonedStepStates[key] = clonedStepState
    })

    this.currentBlockingStep = state.currentBlockingStep
    this.minProcessingStep = state.minProcessingStep
  }

  applyTo (state) {
    Object.keys(this.clonedStepStates).forEach(key => {
      const clonedStepState = this.clonedStepStates[key]
      const stepState = state.stepStates[key]

      stepState.deepCloneInto(clonedStepState, stepState.state)
    })

    state.currentBlockingStep = this.currentBlockingStep
    state.minProcessingStep = this.minProcessingStep
  }
}

/**
 *
 * @param {ProgressInfo} progressInfo
 * @param {courseConfig.NamedCourseItem} courseTree
 * @returns {Object} a mapping from course item to unlock status
 */
function calculateCourseUnlockStatus (progressInfo, courseTree) {
  return Promise.resolve()
    .then(() => {
      const courseItems = courseConfig.flattenCourseTree(courseTree)

      const itemToCompletenessFirstPass = courseItems.reduce(
        (mapping, item) => {
          mapping[item.id] = progressInfo.isItemComplete(item.id) === true
          return mapping
        },
        {}
      )

      const itemToCompleteness = courseItems.reduce(
        (mapping, item) => {
          if (item.children) {
            mapping[item.id] = item.children.map(
              child => itemToCompletenessFirstPass[child.id]
            )
              .every(result => result === true)
          } else {
            mapping[item.id] = itemToCompletenessFirstPass[item.id]
          }

          return mapping
        },
        {}
      )

      return {
        courseItems: courseItems,
        itemToCompleteness: itemToCompleteness
      }
    })
    .then(prev => {
      const courseItems = prev.courseItems
      const itemToCompleteness = prev.itemToCompleteness

      const itemToParent = courseItems.reduce(
        (mapping, current) => {
          if (current.children) {
            current.children.forEach(child => {
              mapping[child] = current
            })
          }

          return mapping
        },
        {}
      )

      function IsUnlockIfPrerequisitesCompleted (item, arePrerequisitesCompletedCb) {
        return !!arePrerequisitesCompletedCb(item)
      }

      const stautsResolverGenerater = new courseConfig.CourseItemVisitor(
        (levelItem) => {
          return (item) =>
            new Error(`Should not need to check progress of an item ${item} that has parent of levelItem ${levelItem}`)
        },
        (sequentialSectionItem) => {
          return (item) => {
            return IsUnlockIfPrerequisitesCompleted(
              item,
              (item) => {
                let prerequisiteCompleted =
                                arePrequesitesCompleted(item, itemToCompleteness)

                const index = sequentialSectionItem.children.indexOf(item)
                if (index < 0) {
                  return new Error(`Claimed that item ${item} has sequentialItem parent ${sequentialSectionItem}, but it actually does not`)
                } else if (index > 0) {
                  const previousItem = sequentialSectionItem.children[index - 1]
                  prerequisiteCompleted &= itemToCompleteness[previousItem.id]
                }

                return prerequisiteCompleted
              }
            )
          }
        },
        (FreeAccessSectionItem) => {
          return (item) => {
            return IsUnlockIfPrerequisitesCompleted(
              item,
              item => arePrequesitesCompleted(item, itemToCompleteness)
            )
          }
        },
        (courseItem) => {
          return (item) => {
            return IsUnlockIfPrerequisitesCompleted(
              item,
              item => arePrequesitesCompleted(item, itemToCompleteness)
            )
          }
        }
      )

      const itemToUnlockStatus = courseItems.reduce(
        (mapping, current) => {
          const parent = itemToParent[current]

          if (parent) {
            const statusResolver = parent.accept(stautsResolverGenerater)
            mapping[current.id] = statusResolver(current)
          } else { // When a course item node has no parent (root), it is unlocked by default
            mapping[current.id] = true
          }

          return mapping
        },
        {}
      )

      const unlockStatusMap = {}
      courseItems.forEach(item => {
        const id = item.id
        unlockStatusMap[id] = (
          itemToCompleteness[id] === true
            ? ProgressEnum.COMPLETED
            : (
                itemToUnlockStatus[id] === true
                  ? ProgressEnum.UNLOCKED
                  : ProgressEnum.LOCKED
              )
        )
      })

      return unlockStatusMap
    })

  function arePrequesitesCompleted (item, itemToCompleteness) {
    if (item.prerequisiteIds) {
      return item.prerequisiteIds.every(id => itemToCompleteness[id] === true)
    } else {
      return true
    }
  }
}

const store = {
  state: {
    appState: {
      courseName: null,
      language: null
    },
    courseOptions: {},
    levelState: {
      isDebug: api.isDebug(),
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

        courseNameLabel: '',
        languageLabel: '',
        saveAndCloseLabel: '',
        closeLabel: '',
        configTitle: '',

        loadEbusyMessage: ''
      },
      commonAssetRelativePaths: {
        imgCorrect: ''
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
      workingPaths: {}
    },
    courseState: {
      isReady: false,
      courseTree: null,
      courseList: null,
      courseItemIdToUnlockStatus: null,
      courseName: ''
    },
    pageState: {
      displayingNode: null
    },
    progressManager: new ProgressManager()
  },
  get appState () {
    return this.state.appState
  },
  get levelState () {
    return this.state.levelState
  },
  get courseState () {
    return this.state.courseState
  },
  get pageState () {
    return this.state.pageState
  },
  initialize () {
    return api.invokeSelect('initialize')
      .then(initialData => {
        Object.assign(this.appState, initialData.appConfig)
        Object.assign(this.state.courseOptions, initialData.courseOptions)
      })
  },
  loadTerms () {
    const loadPromises = []

    Object.keys(this.levelState.terms).forEach(key => {
      loadPromises.push(
        api.invokeLoad('loadCommonString', key, this.appState.language)
          .then(term => {
            this.levelState.terms[key] = term
          })
      )
    })

    return Promise.all(loadPromises)
  },
  loadCommonAssetRelativePaths () {
    const loadPromises = []

    Object.keys(this.levelState.commonAssetRelativePaths).forEach(key => {
      loadPromises.push(
        api.invokeLoad('loadCommonAssetPath', key, this.appState.language)
          .then(fullAssetPath => {
            return this.getAssetRelativePath(
              fullAssetPath
            )
          })
          .then(relativePath => {
            this.levelState.commonAssetRelativePaths[key] = relativePath
          })
      )
    })

    return Promise.all(loadPromises)
  },
  loadText (assetId) {
    return api.invokeLoad('loadCourseText', assetId, this.state.courseState.courseName, this.appState.language)
  },
  processAssetIdInText (text) {
    return api.invokeSelect('processAssetIdInText', text, this.appState.language)
  },
  processMarkdown (content) {
    if (content.startsWith('.md')) {
      return marked(content.slice(3))
    } else {
      return content
    }
  },
  getAssetRelativePath (assetFullPath) {
    return api.invokeSelect('getAssetRelativePath', assetFullPath)
  },
  loadCourse () {
    this.courseState.isReady = false
    this.courseState.courseTree = null
    this.courseState.courseList = null

    return api.invokeLoad('loadCourseRaw', this.appState.courseName, this.appState.language)
      .then(content => {
        return yaml.safeLoad(content, { schema: COURSE_CONFIG_SCHEMA })
      })
      .then(course => {
        this.courseState.courseTree = this.buildCourseTree(course)
        this.courseState.courseList = courseConfig.flattenCourseTree(course)
        this.courseState.isReady = true
        this.courseState.courseName = this.appState.courseName
      })
      .then(() => {
        return this.state.progressManager.getProgress(this.state.courseState.courseName)
      })
      .then(progressInfo => {
        return calculateCourseUnlockStatus(
          progressInfo,
          this.courseState.courseTree
        )
          .then(unlockStatus => {
            this.courseState.courseItemIdToUnlockStatus = unlockStatus
          })
      })
      .then(() => {
        return api.invokeSelect('setCurrentCourse', this.appState.courseName)
      })
      .catch(err => {
        console.error(err)
        this.courseState.isReady = false
        this.courseState.courseName = ''
      })
  },
  loadLevel (levelName) {
    this.levelState.stepsReady = false
    this.levelState.interactable = false
    this.levelState.levelName = levelName
    this.levelState.renderSteps = []
    this.levelState.stepStates = {}
    this.levelState.blockingSteps = []
    this.levelState.needProcessSteps = []
    this.levelState.currentBlockingStep = Number.MAX_SAFE_INTEGER
    this.levelState.minProcessingStep = Number.MAX_SAFE_INTEGER
    this.levelState.actionExecutor = null
    this.levelState.checkpoints = {}
    this.levelState.repoSetupNames = []
    this.levelState.workingPaths = {}

    return api.invokeSelect('loadLevel', levelName, this.appState.language)
      .then(mainLevelState => {
        this.levelState.workingPaths = mainLevelState.workingPaths
        this.levelState.repoSetupNames = mainLevelState.repoSetupNames

        console.log(mainLevelState.steps)
        return yaml.safeLoad(mainLevelState.steps, { schema: LEVEL_CONFIG_SCHEMA })
      })
      .then(stepConfigs => {
        return Promise.resolve()
          .catch(err => {
            console.error(`Error occured when loading repo setups ${err}`)
            if (err.code === 'EBUSY') {
              return dialog.showMessageBox({
                message: this.state.levelState.terms.loadEbusyMessage
              })
                .then(() => {
                  throw err
                })
            }
            throw err
          })
          .then(() => {
            console.log(`loading ${levelName} steps`)
            loadLevelSteps.call(this, stepConfigs)
          })
          .catch(err => {
            console.error(`error occured when loading level ${levelName}`)
            throw err
          })
      })
      .catch(err => {
        console.error(err)
        throw err
      })
  },
  verifyInputAnswer (stepKey, input) {
    const stepState = this.levelState.stepStates[stepKey]

    assert(
      stepState.step instanceof stepConfigs.VerifyInputStep,
            `VerifyInputAnswer is expected to be invoked by a VerifyInputStep, but is actually invoked by ${stepState.step} at index ${stepKey}`
    )

    let processedAnswer
    return Promise.resolve()
      .then(() => {
        return new Promise(resolve => {
          setTimeout(resolve, 500)
        })
          .then(() => {
            return api.invokeSelect(
              'processAssetIdInText',
              stepState.step.answer,
              this.appState.language
            )
              .then(processed => {
                processedAnswer = processed
              })
          })
      })
      .then(() => {
        return input === processedAnswer
      })
  },
  resetReposToLatestCheckpoint (resettingRepos, currentStepKey) {
    this.levelState.interactable = false

    const createLastCheckPointFinder = () => {
      const intStepKeys = Object.keys(
        this.levelState.stepStates
      ).map(k => parseInt(k))

      intStepKeys.sort(function (a, b) { return a - b })

      const intCurrentStepKey = parseInt(currentStepKey)
      let previousIntStepKeys = intStepKeys.slice(
        0,
        intStepKeys.indexOf(intCurrentStepKey)
      )

      previousIntStepKeys = previousIntStepKeys.reverse()

      const genLastCheckpointActionorRepo = (repoSetupName) => {
        const intStepKeyFound = previousIntStepKeys.find(
          intStepKey => {
            const step = this.levelState.stepStates[intStepKey.toString()].step
            if (step instanceof stepConfigs.AllRepoCheckpointStep) {
              return true
            } else if (step instanceof stepConfigs.CheckpointStep) {
              return step.repoSetupNames.includes(repoSetupName)
            } else {
              return false
            }
          }
        )

        if (intStepKeyFound) {
          const stepFound = this.levelState.stepStates[intStepKeyFound.toString()].step

          return new actionConfigs.LoadCheckpointAction(
            repoSetupName,
            stepFound.checkpointName
          )
        } else {
          return undefined
        }
      }

      return genLastCheckpointActionorRepo
    }

    return Promise.resolve()
      .then(() => createLastCheckPointFinder())
      .then(genLastCheckpointActionorRepo => {
        const resetPromise = resettingRepos.reduce(
          (acc, resettingRepoSetupName) => {
            const action = genLastCheckpointActionorRepo(
              resettingRepoSetupName
            )

            return action
              ? acc.then(() => invokeExecute(action))
              : acc
          },
          Promise.resolve()
        )

        return resetPromise
      })
      .catch(error => {
        console.error(error)
      })
      .finally(() => {
        this.levelState.interactable = true
      })
  },
  executeActions (actions) {
    this.levelState.interactable = false

    return executeActionsSequentially.call(this, actions)
      .then(() => {
        return true
      })
      .catch(err => {
        console.error(err)
        return false
      })
      .finally(() => {
        this.levelState.interactable = true
      })
  },
  saveCheckpoint (stepKey) {
    this.levelState.interactable = false

    const stepState = this.levelState.stepStates[stepKey]

    assert(
      stepState.step instanceof stepConfigs.CheckpointStep ||
            stepState.step instanceof stepConfigs.AllRepoCheckpointStep,
            `Only CheckpointStep or AllRepoCheckpointStep can invoke saveCheckpoint method in store, but ${stepKey} is not`)

    return Promise.resolve()
      .then(() => {
        let executeSaveCheckpoints = Promise.resolve()

        const repoSetupNames =
                stepState.step instanceof stepConfigs.CheckpointStep
                  ? stepState.step.repoSetupNames
                  : this.levelState.repoSetupNames

        repoSetupNames.forEach(repoSetupName => {
          const action = new actionConfigs.SaveCheckpointAction(
            repoSetupName,
            stepState.step.checkpointName
          )

          executeSaveCheckpoints = executeSaveCheckpoints.then(() => {
            return invokeExecute(action)
          })
        })

        return executeSaveCheckpoints
      })
      .then(() => {
        this.levelState.checkpoints[stepKey] = new StoreStateCheckpoint(this.levelState)
      })
      .then(() => {
        return true
      })
      .catch(error => {
        console.error(error)
        return false
      })
      .finally(() => {
        this.levelState.interactable = true
      })
  },
  loadCheckpoint (stepKey) {
    this.levelState.interactable = false

    const stepState = this.levelState.stepStates[stepKey]

    assert(
      stepState.step instanceof stepConfigs.CheckpointStep ||
            stepState.step instanceof stepConfigs.AllRepoCheckpointStep,
            `Only CheckpointStep or AllRepoCheckpointStep can invoke loadCheckpoint method in store, but ${stepKey} is not`)

    assert(stepKey in this.levelState.checkpoints)

    return Promise.resolve()
      .then(() => {
        let loadCheckpoints = Promise.resolve()

        const repoSetupNames =
                stepState.step instanceof stepConfigs.CheckpointStep
                  ? stepState.step.repoSetupNames
                  : this.levelState.repoSetupNames

        repoSetupNames.forEach(repoSetupName => {
          const action = new actionConfigs.LoadCheckpointAction(
            repoSetupName,
            stepState.step.checkpointName
          )

          loadCheckpoints = loadCheckpoints.then(() => {
            return invokeExecute(action)
          })
        })

        return loadCheckpoints
      })
      .then(() => {
        const checkpoint = this.levelState.checkpoints[stepKey]
        checkpoint.applyTo(this.levelState)
      })
      .then(() => {
        return true
      })
      .catch(error => {
        console.error(error)
        return false
      })
      .finally(() => {
        this.levelState.interactable = true
      })
  },
  verifyRepoEqual (stepKey) {
    this.levelState.interactable = false

    const stepState = this.levelState.stepStates[stepKey]

    assert(
      stepState.step instanceof stepConfigs.VerifyRepoStep ||
            stepState.step instanceof stepConfigs.VerifyAllRepoStep,
            `Only VerifyRepoStep or VerifyAllRepoStep can invoke verifyRepoEqual method in store, but ${stepKey} is actuall ${typeof (step)}`)

    return Promise.resolve()
      .then(() => {
        const referenceName = stepState.step.referenceName// || `${this.levelState.levelName}-${stepKey}`;

        assert(
          referenceName,
                `step with key ${stepKey} should define referenceName`
        )

        let verifyRepos = Promise.resolve()

        const repoSetupNames =
                stepState.step instanceof stepConfigs.VerifyRepoStep
                  ? [stepState.step.repoSetupName]
                  : this.levelState.repoSetupNames

        const resultMapping = {}

        repoSetupNames.forEach(repoSetupName => {
          const action = new actionConfigs.CompareReferenceAction(
            repoSetupName,
            referenceName
          )

          verifyRepos = verifyRepos.then(() => {
            return invokeExecute(action)
              .then(result => {
                resultMapping[repoSetupName] = result
              })
          })
        })

        return verifyRepos.then(() => {
          return Object.keys(resultMapping).every(key => resultMapping[key])
        })
      })
      .catch(error => {
        console.error(error)
        return false
      })
      .finally(() => {
        this.levelState.interactable = true
      })
  },
  loadRepoReferenceForVerifyStep (stepKey) {
    if (!this.levelState.isDebug) return Promise.resolve(new Error('loadRepoReferenceForVerifyStep is debug only!'))

    this.levelState.interactable = false

    const stepState = this.levelState.stepStates[stepKey]

    assert(
      stepState.step instanceof stepConfigs.VerifyAllRepoStep ||
            stepState.step instanceof stepConfigs.VerifyRepoStep,
            `Only VerifyAllRepoStep or VerifyRepoStep can invoke loadCheckpoint method in store, but ${stepKey} is not`)

    return Promise.resolve(getRepoSetupNamesForStep.call(this, stepState.step))
      .then(repoSetupNames => {
        return assembleLoadReferenceActions(
          repoSetupNames,
          stepState.step.referenceName
        )
      })
      .then(actions => {
        return this.executeActions(actions)
      })
  },
  loadAllRepoReferences (stepKey) {
    const stepState = this.levelState.stepStates[stepKey]
    assert(
      stepState.step instanceof stepConfigs.LoadAllReferenceStep,
            `Only LoadAllReferenceStep can invoke loadAllRepoReference method, but actually is ${stepKey} is not`
    )

    return Promise.resolve(getRepoSetupNamesForStep.call(this, stepState.step))
      .then(repoSetupNames => {
        return assembleLoadReferenceActions(
          repoSetupNames,
          stepState.step.referenceName
        )
      })
      .then(actions => {
        return this.executeActions(actions)
      })
  },
  loadLastLevelFinalSnapshot (stepKey) {
    const currentLevel = this.state.pageState.displayingNode
    const previousLevel = courseConfig.findLastLevel(
      this.courseState.courseList,
      currentLevel
    )

    if (previousLevel === null) {
      console.error(`Failed to find pervious level for ${currentLevel.id}`)
      return Promise.resolve(false)
    } else {
      this.levelState.interactable = false

      const step = this.state.levelState.stepStates[stepKey].step

      assert(
        step instanceof stepConfigs.LoadLastLevelFinalSnapshotStep,
                `Expect LoadLastStageFinalSnapshotStep invoking store.loadLastLevelFinalSnapshot, but actually invoked by ${stepKey} which is of type ${typeof (step)}`
      )

      return Promise.resolve(getRepoSetupNamesForStep.call(this, step))
        .then(repoSetupNames => {
          return assembleLoadReferenceActions(
            repoSetupNames,
                    `${previousLevel.id}-final-snapshot`
          )
        })
        .then(actions => {
          return this.executeActions(actions)
        })
    }
  },
  openWorkingPath (stepKey) {
    return new Promise(resolve => {
      const step = this.levelState.stepStates[stepKey].step

      assert(step instanceof stepConfigs.OpenWorkingPathStep, `Only OpenWorkingPathStep can invoke OpenWorkingPath method, but ${stepKey} is actually ${typeof (step)}`)

      resolve(this.levelState.workingPaths[step.repoSetupName])
    })
      .then(workingPath => api.invokeSelect('openWorkingPath', workingPath))
  },
  unblock (stepKey) {
    const unblockedIndex = parseInt(stepKey)
    assert(unblockedIndex <= this.levelState.currentBlockingStep, `Expect unblocked index ${unblockedIndex} should be smaller than or equal to currently blocking index ${this.levelState.currentBlockingStep}`)
    assert(unblockedIndex <= this.levelState.minProcessingStep, `Expect all previous processing steps completed before unblocking for index ${unblockedIndex}`)

    const blockingStepArrayIndex = this.levelState.blockingSteps.indexOf(unblockedIndex)
    if (blockingStepArrayIndex != this.levelState.blockingSteps.length - 1) {
      this.levelState.currentBlockingStep = this.levelState.blockingSteps[blockingStepArrayIndex + 1]
    } else {
      this.levelState.currentBlockingStep = Object.keys(this.levelState.stepStates).length
    }

    this.updateBlockingStates()
  },
  markProcessComplete (stepKey) {
    const index = parseInt(stepKey)

    if (index === this.levelState.minProcessingStep) {
      let i = this.levelState.minProcessingStep + 1
      for (; i <= this.levelState.currentBlockingStep; i++) {
        const stepState = this.levelState.stepStates[`${i}`]
        if (stepState.step.needProcess) {
          if (stepState.state.processState === ProcessState.PROCESSING) {
            this.levelState.minProcessingStep = i
            break
          }
        }
      }

      if (i === this.levelState.currentBlockingStep) {
        this.levelState.minProcessingStep = i
      }
    }

    // Update the state after updating minProcessingStep
    // because updating state might trigger unblock
    this.levelState.stepStates[stepKey].state.processState = ProcessState.PROCESS_COMPLETE
  },
  updateBlockingStates () {
    this.levelState.minProcessingStep = Object.keys(this.levelState.stepStates).length

    Object.keys(this.levelState.stepStates).forEach(stepKey => {
      const stepState = this.levelState.stepStates[stepKey]

      const parsedIndex = parseInt(stepKey)
      stepState.state.isBlocked = parsedIndex > this.levelState.currentBlockingStep

      if (!stepState.state.isBlocked) {
        if (stepState.step.needProcess && stepState.state.processState === ProcessState.PREPARE_PROCESS) {
          stepState.state.processState = ProcessState.PROCESSING
          this.levelState.minProcessingStep = Math.min(
            this.levelState.minProcessingStep,
            parsedIndex
          )
        }
      }
    })
  },
  buildCourseTree (course) {
    course.parent = null

    const queue = [course]

    while (queue.length !== 0) {
      const current = queue.shift()

      if (current instanceof courseConfig.NestedNamedCourseItem) {
        current.children.forEach(child => {
          child.parent = current
          queue.push(child)
        })
      }

      if (current instanceof courseConfig.SequentialSectionItem) {
        const previousIds = []
        current.children.forEach(child => {
          child.prerequisiteIds = child.prerequisiteIds.concat(previousIds)
          previousIds.push(child.id)
        })
      }
    }

    return course
  },
  navigate (node) {
    return Promise.resolve()
      .then(() => {
        if (node instanceof courseConfig.LevelItem) {
          return this.loadLevel(node.configAssetId)
            .then(() => {
              this.state.pageState.displayingNode = node
            })
        } else {
          this.state.pageState.displayingNode = node
        }
      })
  },
  saveProgress () {
    const currentLevel = this.state.pageState.displayingNode

    return this.state.progressManager.getProgress(this.state.courseState.courseName)
      .then(progressInfo => {
        progressInfo.setItemComplete(currentLevel.id)
        return this.state.progressManager.setProgress(progressInfo)
          .then(() => {
            return calculateCourseUnlockStatus(
              progressInfo,
              this.courseState.courseTree
            )
              .then(unlockStatus => {
                this.courseState.courseItemIdToUnlockStatus = unlockStatus
              })
          })
      })
      .catch(err => {
        console.error(err)
        return false
      })
      .then(() => {
        return true
      })
  },
  completeLevel () {
    return Promise.resolve()
      .then(() => {
        this.state.pageState.displayingNode = this.state.pageState.displayingNode.parent
      })
  },
  openConfig () {
    const configNode = {
      renderComponent: 'config',
      previousPage: this.state.pageState.displayingNode,
      currentConfig: Object.assign({}, this.state.appState)
    }

    return this.navigate(configNode)
  },
  closeConfig (newConfig) {
    if (this.appState.courseName !== newConfig.courseName ||
            this.appState.language !== newConfig.language) { // save config and reset app
      this.state.courseState.isReady = false

      return api.invokeAppConfigService('saveConfiguration', newConfig)
        .then(() => api.invokeAppConfigService('loadConfiguration'))
        .then(config => Object.assign(this.appState, config))
        .then(() => this.loadTerms())
        .then(() => {
          return this.loadCommonAssetRelativePaths()
        })
        .then(() => {
          return this.loadCourse()
        })
        .then(() => {
          this.navigate(this.courseState.courseTree)
        })
    } else {
      return this.navigate(this.pageState.displayingNode.previousPage) // back to previous page
    }
  }
}

exports = module.exports = store
