'use strict'

const path = require('path')
const fs = require('fs-extra')
const yaml = require('js-yaml')
const simpleGit = require('simple-git/promise')
const utils = require('./test-utils')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

const zip = require('../../src/main/simple-archive')
const vcs = require('../../src/main/repo-vcs')

const ActionExecutor = require('../../dev/action-executor').DevActionExecutor
const AssetLoader = require('../../src/main/asset-loader').AssetLoader

chai.use(chaiAsPromised)
chai.should()

describe('Prepare VCS Miscellaneous #core', function () {
  const testingStorageTypes = [
    vcs.STORAGE_TYPE.ARCHIVE
    // vcs.STORAGE_TYPE.GIT
  ]

  it('GENERATE_TESTS', function () {
    testingStorageTypes.forEach(testingStorageType => {
      createTests(testingStorageType)
    })
  })
})

function createTests (storageType) {
  describe(`VCS Miscellaneous - ${vcs.STORAGE_TYPE.toString(storageType)} storage`, function () {
    this.timeout(4000)

    const archiveCreationConfigExecutor = new utils.RepoArchiveConfigExecutor()

    describe('Local', function () {
      const workingPath = path.join(utils.PLAYGROUND_PATH, 'compare-vcs')

      const referenceStorePath = path.join(workingPath, 'repo-store')
      const referenceStoreName = 'compare-vcs-local-ref'

      const archivePath = path.join(utils.RESOURCES_PATH, 'repo-archive')
      const referenceArchivePath = path.join(archivePath, `compare-vcs-local-ref-${vcs.STORAGE_TYPE.toString(storageType)}.zip`)
      const checkedArchivePath = path.join(archivePath, 'compare-vcs.zip')

      let repo
      let refManager
      let stageMap = {}
      let actionExecutor
      let checkedRepoPath

      const resetCheckRepo = function () {
        return fs.remove(checkedRepoPath)
          .then(() => zip.extractArchiveTo(checkedArchivePath, checkedRepoPath))
          .then(() => repo = simpleGit(checkedRepoPath))
      }

      before(function () {
        const assetStorePath = path.join(utils.RESOURCES_PATH, 'vcs-compare', 'assets')
        const yamlPath = path.join(utils.RESOURCES_PATH, 'vcs-compare', 'generate-testing-ref-repo.yaml')

        return Promise.resolve()
          .then(() => {
            return archiveCreationConfigExecutor.loadConfig(yamlPath)
          })
          .then(config => {
            stageMap = config.stageMap

            const assetLoader = new AssetLoader(assetStorePath)

            const repoSetups =
                        archiveCreationConfigExecutor.createRepoVcsSetupsFromConfig(
                          config
                        )

            actionExecutor = new ActionExecutor(
              workingPath,
              undefined,
              assetLoader,
              repoSetups,
              storageType
            )

            checkedRepoPath =
                        actionExecutor
                          .getRepoFullPaths('local')
                          .fullWorkingPath
          })
          .then(() => {
            return fs.emptyDir(workingPath)
              .then(() => fs.emptyDir(referenceStorePath))
              .then(() => zip.extractArchiveTo(referenceArchivePath, path.join(referenceStorePath, referenceStoreName)))
              .then(() => zip.extractArchiveTo(checkedArchivePath, checkedRepoPath))
          })
          .then(() => {
            return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, false, storageType)
              .then(result => {
                refManager = result
              })
          })
      })

      after('Clean Up', function () {
        return fs.emptyDir(workingPath)
          .then(() => fs.remove(workingPath))
      })

      beforeEach('Reset Checked Repository', function () {
        return resetCheckRepo()
      })

      describe('Contains', function () {
        it('existing reference should return true', function () {
          return refManager.contains('clean')
            .should.eventually.equal(true, 'expect ReferenceManager contains "clean"')
            .then(() => {
              return refManager.contains('conflictMixed')
                .should.eventually.equal(true, 'expect ReferenceManager contains "conflictMixed"')
            })
        })

        it('non-existing reference should return false', function () {
          return refManager.contains('what-so-ever-randome-branch-name')
            .should.eventually.equal(false)
        })
      })
    })

    describe('Remote', function () {
      const workingPath = path.join(utils.PLAYGROUND_PATH, 'compare-vcs')

      const repoStorePath = path.join(workingPath, 'repo-store')
      const referenceStoreName = 'compare-vcs-remote-ref'
      const snapshotsPath = path.join(workingPath, 'snapshots')
      const inspectedPath = path.join(workingPath, 'inspected')

      const config = archiveCreationConfigExecutor.loadConfigSync(
        path.join(utils.RESOURCES_PATH, 'vcs-compare', 'generate-remote-repo.yaml')
      )

      let refManager

      before('Initialize paths', function () {
        return fs.emptyDir(workingPath)
          .then(() => {
            return fs.emptyDir(inspectedPath)
          })
      })

      before('Create ReferenceManager', function () {
        return fs.emptyDir(repoStorePath)
          .then(() => {
            return zip.extractArchiveTo(
              path.join(
                utils.ARCHIVE_RESOURCES_PATH,
                            `compare-vcs-remote-ref-${vcs.STORAGE_TYPE.toString(storageType)}.zip`
              ),
              path.join(repoStorePath, referenceStoreName)
            )
          })
          .then(() => {
            return vcs.RepoReferenceManager.create(
              inspectedPath,
              repoStorePath,
              referenceStoreName,
              true,
              storageType
            )
          })
          .then(result => {
            refManager = result
          })
      })

      before('Create snapshots', function () {
        const assetLoader = new AssetLoader(
          path.join(utils.RESOURCES_PATH, config.resourcesSubPath)
        )

        const repoSetups =
                    archiveCreationConfigExecutor.createRepoVcsSetupsFromConfig(
                      config
                    )

        const actionExecutor = new ActionExecutor(
          workingPath,
          path.relative(workingPath, repoStorePath),
          assetLoader,
          repoSetups,
          storageType
        )

        return fs.emptyDir(snapshotsPath)
          .then(() => {
            return archiveCreationConfigExecutor.initializeRepos(
              workingPath,
              utils.ARCHIVE_RESOURCES_PATH,
              config
            )
          })
          .then(() => {
            let captureSnapshots = Promise.resolve()
            config.stageNames.forEach(stageName => {
              captureSnapshots = captureSnapshots.then(() => {
                return archiveCreationConfigExecutor.executeStage(
                  stageName,
                  config.stageMap,
                  actionExecutor
                ).then(() => {
                  return fs.copy(
                    actionExecutor.getRepoFullPaths('remote').fullWorkingPath,
                    path.join(snapshotsPath, stageName)
                  )
                })
                  .catch(err => {
                    console.error(`Error on ${stageName}`)
                    console.error(err)
                    return Promise.reject(err)
                  })
              })
            })

            return captureSnapshots
          })
      })

      after('Clear up', function () {
        return fs.remove(utils.PLAYGROUND_PATH)
      })

      describe('Contains', function () {
        describe('Reports True for Exsiting References', function () {
          config.stageNames.forEach(stageName => {
            it(`${stageName}`, function () {
              return refManager.contains(stageName)
                .should.eventually.equal(true)
            })
          })
        })

        it('reports false for non-existing reference name', function () {
          return refManager.contains('some-randome-branch-name')
            .should.eventually.equal(false)
        })
      })
    })
  })
}
