'use strict'

const path = require('path')
const fs = require('fs-extra')
const simpleGit = require('simple-git/promise')

const zip = require('../src/main/simple-archive')
const vcs = require('../src/main/repo-vcs')
const utility = require('../src/common/utility')
const ActionExecutor = require('../src/main/action-executor').ActionExecutor
const REPO_TYPE = require('../src/common/config-level').REPO_TYPE

const getRepo = Symbol('getRepo')

/**
 * @inheritdoc
 */
class DevActionExecutor extends ActionExecutor {
  constructor (fileSystemBaseFolder, repoStoreSubPath, assetLoader, repoSetups, repoStorageType) {
    super(fileSystemBaseFolder, repoStoreSubPath, assetLoader, repoSetups, repoStorageType)
    this.git = simpleGit()
  }

  executeStaging (repoSetupName, pathSpecs) {
    return this[getRepo](repoSetupName)
      .then(repo => {
        return repo.add(pathSpecs)
          .catch(err => {
            if (!err.toString().includes('fatal: pathspec')) {
              throw err
            }
          })
      })
      .catch(err => {
        console.error('[executeStaging] ' + err.message)
        throw err
      })
  }

  executeMerge (repoSetupName, withBranch) {
    return this[getRepo](repoSetupName)
      .then(repo => {
        return repo.merge([withBranch])
          .catch(err => {
            if (!(err.toString().includes('CONFLICTS:'))) {
              throw err
            }
          })
      })
      .catch(err => {
        console.error('[executeMerge] ' + err.message)
        throw err
      })
  }

  executeContinueMerge (repoSetupName) {
    return this[getRepo](repoSetupName)
      .then(repo => {
        return repo.env('GIT_EDITOR', 'true') // skip editor so the script can continue execution without user interaction
          .merge(['--continue'])
      })
      .catch(err => {
        console.error('[executeContinueMerge] ' + err.message)
        throw err
      })
  }

  executeCleanCheckout (repoSetupName, revSpec) {
    return this[getRepo](repoSetupName)
      .then(repo => {
        return repo.checkout(['-f', revSpec])
          .then(() => {
            return repo.clean('f', ['-d'])
          })
      })
      .catch(err => {
        console.error('[executeCleanCheckout] ' + err.message)
        throw err
      })
  }

  executeGitCommand (repoSetupName, commandArguments, ignoreError) {
    return this[getRepo](repoSetupName)
      .then(repo => {
        const convertArguemtns = commandArguments.reduce(
          (convertArgumentsPromise, argument) => {
            return convertArgumentsPromise.then(convertedArgs => {
              return this.exploitTextAsset(
                argument,
                (originalArgument) => {
                  convertedArgs.push(originalArgument)
                  return convertedArgs
                },
                (converted) => {
                  convertedArgs.push(converted)
                  return convertedArgs
                },
                (argsAsFilePath) => {
                  throw new Error(
                                    `Does not expect git command arguments can be converted to path. Invalid argument: ${argument}`
                  )
                }
              )
            })
          },
          Promise.resolve([])
        )

        return convertArguemtns
          .then(convertedArguments => {
            return repo.raw(convertedArguments)
          })
      })
      .catch(err => {
        if (ignoreError) {
          console.error(`[executeGitCommand] error occured and NOT thrown intentionally when executing git command [${commandArguments.join([','])}]\nerror: ` + err.message + '\n')
          console.error('=====\n')
        } else {
          console.error(`[executeGitCommand] error occured when executing git command [${commandArguments.join([','])}]\nerror: ` + err.message + '\n')
          console.error('=====\n')
          throw err
        }
      })
  }

  executeSaveReference (repoSetupName, referenceName) {
    return this.operateReferenceMaker(
      repoSetupName,
      (refMaker) => {
        return refMaker.save(referenceName)
      }
    )
  }

  executeLoadRepoReferenceArchive (repoSetupName, assetId) {
    const referenceStorePath = this.getRepoFullPaths(repoSetupName).fullReferenceStorePath

    return fs.exists(referenceStorePath)
      .then(isExisting => {
        if (isExisting) {
          return new Error(`Should not load repo archive ${assetId} into a non-empty repo store path ${referenceStorePath} of repo setup ${repoSetupName}`)
        } else {
          return this.assetLoader.getFullAssetPath(assetId)
            .then(archivePath => {
              return zip.extractArchiveTo(
                archivePath,
                referenceStorePath
              )
            })
        }
      })
  }

  executeIdle (seconds) {
    return utility.wait(seconds * 1000)
  }

  executeCloneRepo (sourceRepoSetupName, destinationRepoSetupName) {
    const sourceRepoPath = this.getRepoFullPaths(sourceRepoSetupName).fullWorkingPath
    const destinationRepoPath = this.getRepoFullPaths(destinationRepoSetupName).fullWorkingPath

    if (sourceRepoPath && destinationRepoPath) {
      return this.git.clone(sourceRepoPath, destinationRepoPath)
    } else {
      let error = ''
      if (!sourceRepoPath) {
        error += `Failed to find working directory for ${sourceRepoPath}\n`
      }

      if (!destinationRepoPath) {
        error += `Failed to find working directory for ${destinationRepoPath}\n`
      }

      return Promise.reject(error)
    }
  }

  getRepoSetupNames () {
    return Object.keys(this.repoSetups)
  }

  getRepoFullPaths (repoSetupName) {
    const setup = this.repoSetups[repoSetupName]
    const result = {}
    if (setup) {
      if (setup.workingPath) {
        result.fullWorkingPath =
                    path.join(
                      this.fileSystemBaseFolder,
                      setup.workingPath
                    )
      }
      if (this.repoStoreSubPath) {
        if (setup.referenceStoreName) {
          result.fullReferenceStorePath =
                        path.join(
                          this.fileSystemBaseFolder,
                          this.repoStoreSubPath,
                          setup.referenceStoreName
                        )
        }
        if (setup.checkpointStoreName) {
          result.fullCheckpointStorePath =
                        path.join(
                          this.fileSystemBaseFolder,
                          this.repoStoreSubPath,
                          setup.checkpointStoreName
                        )
        }
      }
    }

    return result
  }

  [getRepo] (repoSetupName) {
    const setup = this.repoSetups[repoSetupName]
    if (!setup) {
      return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`))
    } else {
      if (!('devRepo' in setup)) {
        setup.devRepo = simpleGit(path.join(this.fileSystemBaseFolder, setup.workingPath))
        setup.devRepo.silent(true)
      }

      return Promise.resolve(setup.devRepo)
    }
  }

  operateReferenceMaker (repoSetupName, operation) {
    const getReferenceMaker = () => {
      const setup = this.repoSetups[repoSetupName]
      if (!setup) {
        return Promise.reject(new Error(`Cannot find repo setup ${repoSetupName}`))
      } else {
        if (!('referenceMaker' in setup)) {
          return vcs.RepoReferenceMaker.create(
            path.join(this.fileSystemBaseFolder, setup.workingPath),
            path.join(this.fileSystemBaseFolder, this.repoStoreSubPath),
            setup.referenceStoreName,
            setup.repoType === REPO_TYPE.REMOTE,
            this.repoStorageType
          )
            .then(result => {
              setup.referenceMaker = result
              return result
            })
        } else {
          return Promise.resolve(setup.referenceMaker)
        }
      }
    }

    return getReferenceMaker()
      .then(referenceMaker => {
        return operation(referenceMaker)
      })
  }
}

module.exports.DevActionExecutor = DevActionExecutor
