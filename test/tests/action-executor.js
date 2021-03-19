'use strict'

const path = require('path')
const fs = require('fs-extra')
const simpleGitCtor = require('simple-git/promise')

const zip = require('../../src/main/simple-archive')
const devParams = require('../../dev/parameters')
const normalizePathSep = require('../../src/main/noarmalize-path-sep')
const wait = require('../../src/common/utility').wait

const utils = require('./test-utils')
const AssetLoader = require('../../src/main/asset-loader').AssetLoader
const ActionExecutor = require('../../src/main/action-executor').ActionExecutor
const RepoVcsSetup = require('../../src/common/config-level').RepoVcsSetup
const REPO_TYPE = require('../../src/common/config-level').REPO_TYPE
const actionTypes = require('../../dev/config-action')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
chai.should()

function parseRefs (refs) {
  const lines = refs.split('\n')

  const locals = {}
  const remotes = {}
  const misc = {}

  lines.forEach(line => {
    const tokens = line.split(' ')

    if (tokens.length === 2) {
      const refPath = tokens[1].slice(5)
      if (refPath.startsWith('heads/')) {
        locals[refPath.slice(6)] = tokens[0]
      } else if (refPath.startsWith('remotes/')) {
        const remotePath = refPath.slice(8)
        const slashIndex = remotePath.indexOf('/')

        const remoteName = remotePath.slice(0, slashIndex)
        if (!(remoteName in remotes)) {
          remotes[remoteName] = {}
        }

        remotes[remoteName][remotePath.slice(slashIndex + 1)] = tokens[0]
      } else {
        misc[refPath] = tokens[0]
      }
    }
  })

  return {
    locals: locals,
    remotes: remotes,
    misc: misc
  }
}

function assertRemoteUpdated (localRefs, remoteRefs, remoteName, matchedRefs) {
  chai.expect(localRefs.remotes).to.have.property(remoteName)

  const locals = localRefs.locals
  const localRemotes = localRefs.remotes[remoteName]
  const remotes = remoteRefs.locals

  matchedRefs.forEach(matchedRef => {
    chai.expect(localRemotes).to.have.property(matchedRef)
    chai.expect(localRemotes[matchedRef]).to.equal(locals[matchedRef], `expect local remote cache [${matchedRef}] match with local[${matchedRef}]`)
    chai.expect(remotes).to.have.property(matchedRef)
    chai.expect(remotes[matchedRef]).to.equal(locals[matchedRef], `expect remote[${matchedRef}] match with local:remote[${matchedRef}]`)
  })
}

describe('Action Executor #core', function () {
  let actionExecutor
  const testRepoSetupName = 'test-repo'
  const testRemoteRepoSetupName = 'test-remote-repo'
  const alternativeRemoteRepoSetupName = 'test-remote-repo2'
  const repoParentPath = path.join(utils.PLAYGROUND_PATH, 'repo')
  const repoArchiveName = 'action-executor'
  const workingPath = path.join(repoParentPath, repoArchiveName)
  const remoteWorkingPath = path.join(repoParentPath, testRemoteRepoSetupName)
  const alternativeRemoteWorkingPath = path.join(repoParentPath, alternativeRemoteRepoSetupName)
  const repoStoreCollectionName = 'repo-store'
  const repoStoreCollectionPath = path.join(utils.PLAYGROUND_PATH, repoStoreCollectionName)

  before(function () {
    const assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor', 'resources'))

    const repoSetups = {
      [testRepoSetupName]: new RepoVcsSetup(
        path.relative(utils.PLAYGROUND_PATH, workingPath),
        '',
        '',
        REPO_TYPE.LOCAL
      ),
      [testRemoteRepoSetupName]: new RepoVcsSetup(
        path.relative(utils.PLAYGROUND_PATH, remoteWorkingPath),
        '',
        '',
        REPO_TYPE.REMOTE
      ),
      [alternativeRemoteRepoSetupName]: new RepoVcsSetup(
        path.relative(utils.PLAYGROUND_PATH, alternativeRemoteWorkingPath),
        '',
        '',
        REPO_TYPE.REMOTE
      )
    }

    actionExecutor = new ActionExecutor(
      utils.PLAYGROUND_PATH,
      repoStoreCollectionName,
      assetLoader,
      repoSetups
    )
  })

  describe('File Operations', function () {
    /**
         *
         * @param {string} str
         * @returns {string}
         */
    const reverseString = function (str) {
      return str.split('').reverse().join('')
    }

    const initializeFolder = function (fileSubPaths, baseFolderPath) {
      const operations = fileSubPaths.map(fileSubPath => {
        const filePath = path.join(baseFolderPath, fileSubPath)

        const parsed = path.parse(filePath)

        return fs.ensureDir(parsed.dir)
          .then(() => {
            return fs.exists(filePath)
          })
          .then(exists => {
            let next = Promise.resolve()
            if (exists) {
              next = next.then(() => {
                return fs.remove(filePath)
              })
            }

            next = next.then(() => {
              return fs.writeFile(filePath, reverseString(parsed.name))
            })

            return next
          })
      })

      return Promise.all(operations)
    }

    beforeEach('Initialize Playground', function () {
      return fs.emptyDir(utils.PLAYGROUND_PATH)
    })

    afterEach('Remove Playground', function () {
      return fs.remove(utils.PLAYGROUND_PATH)
    })

    describe('Write File', function () {
      const appendFolderName = function (fileSubPaths, folderName) {
        const ret = []
        fileSubPaths.forEach(fileSubPath => {
          ret.push(folderName + '/' + path.basename(fileSubPath))
        })

        return ret
      }

      /**
             *
             * @param {string} filePath
             * @param {string} content
             */
      const fileHasContent = function (baseFolder, fileSubPath, content) {
        const filePath = path.join(baseFolder, fileSubPath)

        return fs.exists(filePath)
          .then(exists => {
            if (!exists) {
              return false
            } else {
              return fs.readFile(path.join(baseFolder, fileSubPath), 'utf8')
                .then(fileContent => {
                  return fileContent === content
                })
            }
          })
      }

      /**
             *
             * @param {string} baseFolder
             * @param {Array<string>} fileSubPaths
             * @param {Array<string>} contents
             * @returns {Promise<Boolean>}
             */
      const allFilesHasContents = function (baseFolder, fileSubPaths, contents) {
        const checks = []
        fileSubPaths.forEach((subPath, index) => {
          checks.push(
            fileHasContent(baseFolder, subPath, contents[index])
          )
        })

        return Promise.all(checks).then(results => {
          return results.every(result => result)
        })
      }

      it('writes content', function () {
        const rawTargets = ['inFile1', 'inFile2']
        const ondiskTargets = ['manyFiles1']
        const targets = rawTargets.concat(ondiskTargets)

        const keys = appendFolderName(targets, 'write-file')

        keys.forEach((key, index) => {
          // The dollar sign also applies to ondisk asset
          keys[index] = '$' + key
        })

        const contents = []
        rawTargets.forEach(target => {
          contents.push(`${target} raw content`)
        })
        ondiskTargets.forEach(target => {
          contents.push(target)
        })

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              targets,
              contents
            )
          })
          .should.eventually.equal(true)
      })

      it('creates folder', function () {
        const targets = ['sub/file']
        const keys = ['$write-file/inFile1']
        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              targets,
              ['inFile1 raw content']
            )
          })
          .should.eventually.equal(true)
      })

      it('writes to translated path', function () {
        const targets = ['$write-file/translated-path']
        const keys = ['$write-file/inFile1']
        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              ['神秘的路徑.txt'],
              ['inFile1 raw content']
            )
          })
          .should.eventually.equal(true)
      })

      it('files not overwritting', function () {
        const targets = ['manyFiles1', 'manyFiles2']
        const keys = appendFolderName(targets, 'write-file')

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              targets,
              targets
            )
          })
          .should.eventually.equal(true)
      })

      it('files overwritting', function () {
        const targets = ['manyFilesOverwritting1', 'manyFilesOverwritting2']
        const keys = appendFolderName(targets, 'write-file')

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return initializeFolder(targets, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              targets,
              targets
            )
          })
          .should.eventually.equal(true)
      })

      it('files inside path not overwritting', function () {
        const targets = ['manyFilesInPath1', 'manyFilesInPath2']
        const keys = appendFolderName(targets, 'write-file')
        const destinations = appendFolderName(targets, 'parent')

        const action = new actionTypes.WriteFileAction(
          keys,
          destinations
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              destinations,
              targets
            )
          })
          .should.eventually.equal(true)
      })

      it('files inside path overwritting', function () {
        const targets = ['manyFilesInPathOverwritting1', 'manyFilesInPathOverwritting2']
        const keys = appendFolderName(targets, 'write-file')
        const destinations = appendFolderName(targets, 'parent')

        const action = new actionTypes.WriteFileAction(
          keys,
          destinations
        )

        return initializeFolder(destinations, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              destinations,
              targets
            )
          })
          .should.eventually.equal(true)
      })

      it('unrelated files intact', function () {
        const targets = ['manyFiles1', 'manyFiles2']
        const keys = appendFolderName(targets, 'write-file')
        const untouched = ['untouched1', 'untouched2']

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return initializeFolder(targets.concat(untouched), utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return Promise.all([
              allFilesHasContents(
                utils.PLAYGROUND_PATH,
                targets,
                targets
              ),
              allFilesHasContents(
                utils.PLAYGROUND_PATH,
                untouched,
                untouched.map(c => reverseString(c))
              )
            ])
          })
          .should.eventually.deep.equal([true, true])
      })

      it('source not exist should fail', function () {
        const targets = ['not-exists']
        const keys = appendFolderName(targets, 'write-file')

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return initializeFolder(targets, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .should.eventually.be.rejected
      })

      it('source not exist destination untouched', function () {
        const targets = ['not-exists']
        const keys = appendFolderName(targets, 'write-file')

        const action = new actionTypes.WriteFileAction(
          keys,
          targets
        )

        return initializeFolder(targets, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .catch(() => {
            return allFilesHasContents(
              utils.PLAYGROUND_PATH,
              targets,
              targets.map(c => reverseString(c))
            )
          })
          .should.eventually.equal(true)
      })
    })

    describe('Remove File', function () {
      it('remove single', function () {
        const files = [
          'removed',
          'untouched'
        ]

        const action = new actionTypes.RemoveFileAction(['removed'])

        return initializeFolder(files, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return Promise.all([
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'removed'))
                .should.eventually.be.false,
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                .should.eventually.be.true
            ])
          })
      })

      it('remove translated path', function () {
        const targets = ['$write-file/translated-path']
        const action = new actionTypes.RemoveFileAction(
          targets
        )

        return initializeFolder(['神秘的路徑.txt'], utils.PLAYGROUND_PATH)
          .then(() => action.executeBy(actionExecutor))
          .then(() => {
            return fs.access(path.join(utils.PLAYGROUND_PATH, '神秘的路徑.txt'))
              .should.eventually.be.rejected
          })
      })

      it('remove multiple', function () {
        const files = [
          'removed',
          'folder/removed',
          'untouched',
          'folder/untouched'
        ]

        const action = new actionTypes.RemoveFileAction(['removed', 'folder/removed'])

        return initializeFolder(files, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return Promise.all([
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'removed'))
                .should.eventually.equal(false, '<removed> still exists'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'folder/removed'))
                .should.eventually.equal(false, '<folderremoved> still exists'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                .should.eventually.equal(true, '<untouched> got removed'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'folder/untouched'))
                .should.eventually.equal(true, '<folder/untouched> got removed')
            ])
          })
      })

      it('remove folder', function () {
        const files = [
          'removed-folder/file-1',
          'removed-folder/file-2',
          'untouched',
          'untouched-folder/file-1',
          'untouched-folder/file-2'
        ]

        const action = new actionTypes.RemoveFileAction(['removed-folder'])

        return initializeFolder(files, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return Promise.all([
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'removed-folder'))
                .should.eventually.equal(false, 'expect <removed-folder> got removed, but it still exists'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                .should.eventually.equal(true, '<untouched> is removed unexpectedly'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched-folder/file-1'))
                .should.eventually.equal(true, '<untouched-folder/file-1> is removed unexpectedly'),
              fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched-folder/file-2'))
                .should.eventually.equal(true, '<untouched-folder/file-2> is removed unexpectedly')
            ])
          })
      })

      it('any target not exist should fail', function () {
        const existsFiles = [
          'removed',
          'untouched'
        ]

        const action = new actionTypes.RemoveFileAction(
          ['removed', 'notExists']
        )

        return initializeFolder(existsFiles, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .should.eventually.be.rejected
      })

      it('failed action still effective', function () {
        const existsFiles = [
          'removed',
          'folder/removed',
          'untouched',
          'folder/untouched'
        ]

        const action = new actionTypes.RemoveFileAction(
          ['removed', 'folder/removed', 'notExists']
        )

        return initializeFolder(existsFiles, utils.PLAYGROUND_PATH)
          .then(() => {
            return action.executeBy(actionExecutor)
              .should.eventually.be.rejected
          })
          .then(() => {
            return Promise.all([
              fs.access(path.join(utils.PLAYGROUND_PATH, 'removed'))
                .should.eventually.be.rejected,
              fs.access(path.join(utils.PLAYGROUND_PATH, 'folder/removed'))
                .should.eventually.be.rejected,
              fs.access(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                .should.eventually.be.fulfilled,
              fs.access(path.join(utils.PLAYGROUND_PATH, 'folder/untouched'))
                .should.eventually.be.fulfilled
            ])
          })
      })
    })

    describe('Move File', function () {
      function convertFileNamesToFullPath (names) {
        return names.map(
          name => path.join(utils.PLAYGROUND_PATH, name)
        )
      }

      function writeFiles (paths) {
        return paths.reduce(
          (previousTask, currentPath) => {
            return previousTask.then(() => {
              return fs.writeFile(currentPath, currentPath)
            })
          },
          Promise.resolve()
        )
      }

      function assertFilesMoved (sourcePaths, targetPaths) {
        const assertRemoved = sourcePaths.map(source => {
          return fs.access(source).should.be.rejected
        })

        const assertExists = targetPaths.map(target => {
          return fs.access(target).should.be.fulfilled
        })

        return Promise.all(assertRemoved.concat(assertExists))
      }

      function testFilesMoved (
        sourceNames,
        targetNames,
        sourcePaths,
        targetPaths) {
        const action = new actionTypes.MoveFileAction(
          sourceNames,
          targetNames
        )

        return writeFiles(sourcePaths)
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return assertFilesMoved(sourcePaths, targetPaths)
          })
      }

      it('move a file', function () {
        const sourceNames = ['source']
        const targetNames = ['target']
        const sourcePaths = convertFileNamesToFullPath(sourceNames)
        const targetPaths = convertFileNamesToFullPath(targetNames)

        return testFilesMoved(
          sourceNames,
          targetNames,
          sourcePaths,
          targetPaths
        )
      })

      it('move files', function () {
        const sourceNames = ['source-1', 'source-2']
        const targetNames = ['target-1', 'target-2']
        const sourcePaths = convertFileNamesToFullPath(sourceNames)
        const targetPaths = convertFileNamesToFullPath(targetNames)

        return testFilesMoved(
          sourceNames,
          targetNames,
          sourcePaths,
          targetPaths
        )
      })

      it('move file with translated name', function () {
        const sourceNames = ['$write-file/translated-path']
        const targetNames = ['$write-file/translated-path-2']
        const sourcePaths = convertFileNamesToFullPath(['神秘的路徑.txt'])
        const targetPaths = convertFileNamesToFullPath(['另一個路徑.txt'])

        return testFilesMoved(
          sourceNames,
          targetNames,
          sourcePaths,
          targetPaths
        )
      })
    })
  })

  describe('Git Operations', function () {
    const archivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, repoArchiveName + '.zip')

    let repo

    beforeEach('Load Testing Repos', function () {
      this.timeout(7000)

      return fs.emptyDir(workingPath)
        .then(() => {
          return zip.extractArchiveTo(archivePath, repoParentPath)
        })
        .then(() => {
          repo = simpleGitCtor(workingPath)
        })
        .then(() => {
          return wait(100)
        })
        .then(() => {
          return repo.checkout(['-f', 'master'])
        })
        .then(() => {
          return repo.clean('f', ['-d'])
        })
    })

    after('Clear Testing Repo', function () {
      return fs.remove(repoParentPath)
    })

    describe('Stage', function () {
      it('stage single file', function () {
        const action = new actionTypes.StageAction(testRepoSetupName, ['newFile'])

        return fs.writeFile(path.join(workingPath, 'newFile'), 'newFileContent')
          .then(() => {
            return fs.writeFile(path.join(workingPath, 'otherFile'), 'otherFileContent')
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .should.eventually.deep.include({
            created: ['newFile'],
            not_added: ['otherFile']
          })
      })

      it('stage multiple files', function () {
        const action = new actionTypes.StageAction(
          testRepoSetupName,
          ['a.txt', 'c.txt', 'newFile', 'd.txt', 'renamed']
        )

        return fs.readFile(path.join(workingPath, 'a.txt'))
          .then(aContent => {
            return fs.writeFile(
              path.join(workingPath, 'a.txt'),
              aContent + ' appended to ensure changing'
            )
          })
          .then(() => {
            return fs.remove(path.join(workingPath, 'c.txt'))
          })
          .then(() => {
            return fs.writeFile(
              path.join(workingPath, 'newFile'),
              'some'
            )
          })
          .then(() => {
            return fs.rename(
              path.join(workingPath, 'd.txt'),
              path.join(workingPath, 'renamed')
            )
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .then(status => {
            return status
          })
          .should.eventually.deep.include({
            created: ['newFile'],
            deleted: ['c.txt'],
            modified: ['a.txt'],
            renamed: [{ from: 'd.txt', to: 'renamed' }]
          })
      })

      it('stage with pattern', function () {
        const action = new actionTypes.StageAction(
          testRepoSetupName,
          ['*.txt']
        )

        return fs.writeFile(
          path.join(workingPath, 'not_added'),
          'some'
        )
          .then(() => {
            return fs.writeFile(
              path.join(workingPath, 'new1.txt'),
              'some'
            )
              .then(() => {
                return fs.writeFile(
                  path.join(workingPath, 'new2.txt'),
                  'someOther'
                )
              })
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .should.eventually.deep.include({
            created: ['new1.txt', 'new2.txt']
          })
      })

      it('stage all', function () {
        const action = new actionTypes.StageAllAction(testRepoSetupName)

        const fileNames = ['a.txt', 'c.txt', 'd.txt', 'e.txt', 'f.txt']
        const addedFolder = path.join(workingPath, 'newFolder', 'newFolder2')
        const addedFile = path.join(addedFolder, 'newFile')

        const removeAll = () => {
          const removes = []
          fileNames.forEach(fileName => {
            removes.push(fs.remove(path.join(workingPath, fileName)))
          })
          return Promise.all(removes)
        }

        return removeAll()
          .then(() => {
            return fs.ensureDir(addedFolder)
              .then(() => {
                return fs.writeFile(addedFile, 'some content')
              })
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .should.eventually.deep.include({
            deleted: fileNames,
            created: ['newFolder/newFolder2/newFile']
          })
      })

      it('stage not matching no error', function () {
        const action = new actionTypes.StageAction(
          testRepoSetupName,
          ['not_exists']
        )

        return fs.writeFile(path.join(workingPath, 'newFile'), 'some content')
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .should.eventually.deep.include({
            not_added: ['newFile']
          })
      })
    })

    describe('Commit', function () {
      this.timeout(5000)

      it('Fails when nothing to commit', function () {
        const action = new actionTypes.CommitAction(
          testRepoSetupName,
          'nothing'
        )

        return action.executeBy(actionExecutor)
          .should.be.rejected
      })

      const commitedFile = 'a.txt'
      const dirtyNotCommited = 'b.txt'

      function modifyAndStageFiles () {
        return fs.writeFile(
          path.join(workingPath, commitedFile),
          'here are some random content that should never match the original one'
        )
          .then(() => {
            return fs.writeFile(
              path.join(workingPath, dirtyNotCommited),
              'This is some other random content that should never be the same as the original one, again.'
            )
          })
          .then(() => {
            return repo.add([commitedFile])
          })
      }

      it('create commit pushes forward current branch', function () {
        const action = new actionTypes.CommitAction(
          testRepoSetupName,
          'what so ever'
        )

        let originalSha = ''

        return repo.revparse(['HEAD'])
          .then(result => {
            originalSha = result
          })
          .then(() => modifyAndStageFiles())
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            // Expects the commit before the current one, is the original one
            return repo.revparse(['HEAD^'])
              .then(result => {
                return result === originalSha
              })
          })
          .should.eventually.equal(true)
      })

      it('commit message correct', function () {
        const commitMessage = 'Write some commit messages\nThis is second line'
        const action = new actionTypes.CommitAction(
          testRepoSetupName,
          commitMessage
        )

        return modifyAndStageFiles()
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.raw(['cat-file', 'commit', 'HEAD'])
              .then(result => {
                const resultLines = result.split('\n')
                  .filter(s => s.trim() !== '')

                return resultLines.slice(4)// there are 4 meta lines before message
                  .join('\n')
              })
          })
          .should.eventually.equal(commitMessage)
      })

      it('commit file correct', function () {
        const commitMessage = 'Write some commit messages\nThis is second line'
        const action = new actionTypes.CommitAction(
          testRepoSetupName,
          commitMessage
        )

        return modifyAndStageFiles()
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.raw(['diff', '--name-only', 'HEAD', 'HEAD^'])
              .then(result => {
                return result.split('\n')
                  .filter(s => s.trim() !== '')
              })
          })
          .should.eventually.have.members([commitedFile])
      })

      it('unstaged file untouched', function () {
        const action = new actionTypes.CommitAction(
          testRepoSetupName,
          'what so ever'
        )

        return modifyAndStageFiles()
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.status()
          })
          .should.eventually.deep.include({
            not_added: [dirtyNotCommited],
            conflicted: [],
            created: [],
            deleted: [],
            modified: [],
            renamed: [],
            staged: []
          })
      })
    })

    describe('Merge', function () {
      it('merge branches', function () {
        const toBranch = 'master'
        const fromBranch = 'mergable'

        const action = new actionTypes.MergeAction(
          testRepoSetupName,
          fromBranch
        )

        let toBranchSha
        let fromBranchSha
        let parentOneSha
        let parentTwoSha

        return repo.revparse([toBranch, fromBranch])
          .then(results => {
            toBranchSha = results[0]
            fromBranchSha = results[1]
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.revparse([toBranch + '^1', toBranch + '^2'])
              .then(results => {
                parentOneSha = results[0]
                parentTwoSha = results[1]
              })
          })
          .then(() => {
            return parentOneSha === toBranchSha &&
                        parentTwoSha === fromBranchSha
          })
          .should.eventually.be.true
      })

      it('merge conflict will stop', function () {
        const toBranch = 'master'
        const fromBranch = 'conflict-MM'

        const action = new actionTypes.MergeAction(
          testRepoSetupName,
          fromBranch
        )

        let currentSha
        return repo.revparse([toBranch])
          .then(result => {
            currentSha = result
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return repo.revparse(['HEAD'])
              .then(result => {
                result.should.equal(currentSha)
              })
              .then(() => {
                return repo.status()
              })
              .then(result => {
                result.should.deep.include({
                  conflicted: ['a.txt']
                })
              })
          })
          .should.be.fulfilled
      })
    })

    describe('Clean Checkout', function () {
      const assertCleanAt = function (targetSha) {
        return repo.revparse(['HEAD'])
          .then(result => {
            result.trim().should.equal(targetSha.trim())
          })
          .then(() => {
            return repo.status()
          })
          .then(result => {
            result.should.deep.include({
              not_added: [],
              conflicted: [],
              created: [],
              deleted: [],
              modified: [],
              renamed: [],
              staged: []
            })
          })
      }

      const assertCleanCheckout = function (commitish) {
        const action = new actionTypes.CheckoutAction(
          testRepoSetupName,
          commitish
        )

        let targetSha
        return repo.revparse([commitish])
          .then(result => {
            targetSha = result
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return assertCleanAt(targetSha)
          })
          .should.be.fulfilled
      }

      it('checkout head', function () {
        const action = new actionTypes.CheckoutAction(
          testRepoSetupName,
          'HEAD'
        )

        const newFileName = 'newFile'
        const newStagedFileName = 'newStageFile'
        const dirtyFileName = 'a.txt'
        const dirtyStagedFileName = 'c.txt'
        const removedFileName = 'e.txt'
        const removedStagedFileName = 'f.txt'

        let initialSha

        return Promise.resolve()
          .then(() => {
            return repo.revparse(['HEAD'])
              .then(result => {
                initialSha = result
              })
          })
          .then(() => {
            return Promise.all([
              fs.writeFile(path.join(workingPath, newFileName), newFileName),
              fs.writeFile(path.join(workingPath, newStagedFileName), newStagedFileName),
              fs.writeFile(path.join(workingPath, dirtyFileName), 'cdnaifhdaifenfuidnafkldahfuief'),
              fs.writeFile(path.join(workingPath, dirtyStagedFileName), 'jfkdajfiomiofmdodfjdifjsdiofjdisofjsdop'),
              fs.remove(removedFileName),
              fs.remove(removedStagedFileName)
            ])
          })
          .then(() => {
            return repo.add([newStagedFileName, dirtyStagedFileName, removedStagedFileName])
          })
          .then(() => {
            return action.executeBy(actionExecutor)
          })
          .then(() => {
            return assertCleanAt(initialSha)
          })
          .should.be.fulfilled
      })

      it('checkout branch', function () {
        return assertCleanCheckout('conflict-AA')
      })
    })

    describe('Remote Related', function () {
      let remoteRepo

      beforeEach('Initialize Remote', function () {
        return fs.emptyDir(remoteWorkingPath)
          .then(() => {
            return simpleGitCtor(remoteWorkingPath)
          })
          .then(result => {
            remoteRepo = result
            return result.raw(['init', '--bare'])
          })
      })

      describe('Set Remote', function () {
        it('set new remote', function () {
          const remoteNickName = 'kerker'

          const action = new actionTypes.SetRemoteAction(
            testRepoSetupName,
            testRemoteRepoSetupName,
            remoteNickName
          )

          return action.executeBy(actionExecutor)
            .then(() => repo.raw(['remote', 'show']))
            .then(result => {
              return result.trim()
            })
            .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`)
            .then(() => {
              return repo.raw(['remote', 'get-url', remoteNickName])
            })
            .then(result => {
              return normalizePathSep.posix(result.trim())
            })
            .should.eventually.equal(
              normalizePathSep.posix(remoteWorkingPath.trim()),
                        `Expect remote ${remoteNickName} to have url ${remoteWorkingPath}`
            )
        })

        it('overwrites old remote, no warning', function () {
          const remoteNickName = 'kerker'

          const action1 = new actionTypes.SetRemoteAction(
            testRepoSetupName,
            testRemoteRepoSetupName,
            remoteNickName
          )

          const action2 = new actionTypes.SetRemoteAction(
            testRepoSetupName,
            alternativeRemoteRepoSetupName,
            remoteNickName
          )

          return action1.executeBy(actionExecutor)
            .then(() => {
              return repo.raw(['remote', 'show'])
                .then(result => {
                  return result.trim()
                })
                .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`)
            })
            .then(() => {
              return action2.executeBy(actionExecutor)
            })
            .then(() => {
              return repo.raw(['remote', 'show'])
                .then(result => {
                  return result.trim()
                })
                .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`)
                .then(() => {
                  return repo.raw(['remote', 'get-url', remoteNickName])
                })
                .then(result => {
                  return normalizePathSep.posix(result.trim())
                })
                .should.eventually.equal(
                  normalizePathSep.posix(alternativeRemoteWorkingPath),
                            `Expect remote ${remoteNickName} to have url ${alternativeRemoteWorkingPath}`
                )
            })
        })
      })

      describe('Push', function () {
        this.timeout(5000)

        const remoteNickName = 'kerker'

        function moveBranchForward (branchName, fileName) {
          return repo.checkout(['-f', branchName])
            .then(() => {
              return fs.writeFile(
                path.join(workingPath, fileName),
                'some content'
              )
            })
            .then(() => {
              return repo.add([fileName])
            })
            .then(() => {
              return repo.commit('new')
            })
        }

        beforeEach('Set Remote', function () {
          const action = new actionTypes.SetRemoteAction(
            testRepoSetupName,
            testRemoteRepoSetupName,
            remoteNickName
          )

          return action.executeBy(actionExecutor)
        })

        it('normal push single, remote exists', function () {
          const targetRef = 'master'

          const action = new actionTypes.PushAction(
            testRepoSetupName,
            remoteNickName,
            [`refs/heads/${targetRef}:refs/heads/${targetRef}`]
          )

          let localRepoRefsBefore
          let localRepoRefsAfter
          let remoteRepoRefsAfter

          return repo.raw(['show-ref', '-d'])
            .then(result => {
              localRepoRefsBefore = parseRefs(result)
            })
            .then(() => {
              return Promise.resolve(Object.keys(localRepoRefsBefore.remotes)).should.eventually.have.lengthOf(0)
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              return Promise.all([
                repo.raw(['show-ref', '-d']),
                remoteRepo.raw(['show-ref', '-d'])
              ])
            })
            .then(results => {
              localRepoRefsAfter = parseRefs(results[0])
              remoteRepoRefsAfter = parseRefs(results[1])
            })
            .then(() => {
              assertRemoteUpdated(
                localRepoRefsAfter,
                remoteRepoRefsAfter,
                remoteNickName,
                [targetRef]
              )
            })
        })

        it('normal push single, remote not exists fails', function () {
          const targetRef = 'master'

          const action = new actionTypes.PushAction(
            testRepoSetupName,
            remoteNickName,
            [`refs/heads/${targetRef}:refs/heads/${targetRef}`]
          )

          return fs.remove(remoteWorkingPath)
            .then(() => {
              return action.executeBy(actionExecutor)
                .should.be.rejected
            })
        })

        it('push update single', function () {
          const targetRef = 'master'

          const action = new actionTypes.PushAction(
            testRepoSetupName,
            remoteNickName,
            [`refs/heads/${targetRef}:refs/heads/${targetRef}`]
          )

          let localRefFirstPush
          let localRefSecondPush

          return action.executeBy(actionExecutor)
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefFirstPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                })
                .then(result => {
                  remoteRefs = parseRefs(result)
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefFirstPush,
                    remoteRefs,
                    remoteNickName,
                    [targetRef]
                  )

                  chai.expect(Object.keys(localRefFirstPush.remotes[remoteNickName]))
                    .to.have.lengthOf(1)
                })
            })
            .then(() => {
              return moveBranchForward(targetRef, 'some-not-existing')
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefSecondPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                })
                .then(result => {
                  remoteRefs = parseRefs(result)
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefSecondPush,
                    remoteRefs,
                    remoteNickName,
                    [targetRef]
                  )

                  chai.expect(Object.keys(localRefSecondPush.remotes[remoteNickName]))
                    .to.have.lengthOf(1)

                  chai.expect(localRefFirstPush.remotes[remoteNickName][targetRef])
                    .to.not.equal(localRefSecondPush.remotes[remoteNickName][targetRef])
                })
            })
        })

        it('push update all', function () {
          const action = new actionTypes.PushAllAction(
            testRepoSetupName,
            remoteNickName,
            false
          )

          let localBranches
          let localRefFirstPush
          let localRefSecondPush

          return repo.branchLocal()
            .then(result => {
              localBranches = Object.keys(result.branches)
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefFirstPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                })
                .then(result => {
                  remoteRefs = parseRefs(result)
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefFirstPush,
                    remoteRefs,
                    remoteNickName,
                    localBranches
                  )
                })
            })
            .then(() => {
              return moveBranchForward('master', 'some-not-existing')
            })
            .then(() => {
              return moveBranchForward('mergable', 'some-not-existing-2')
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefSecondPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                })
                .then(result => {
                  remoteRefs = parseRefs(result)
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefSecondPush,
                    remoteRefs,
                    remoteNickName,
                    localBranches
                  )

                  localBranches.forEach(branch => {
                    if (branch === 'master' || branch === 'mergable') {
                      chai.expect(localRefFirstPush.remotes[remoteNickName][branch])
                        .to.not.equal(localRefSecondPush.remotes[remoteNickName][branch])
                    } else {
                      chai.expect(localRefFirstPush.remotes[remoteNickName][branch])
                        .to.equal(localRefSecondPush.remotes[remoteNickName][branch])
                    }
                  })
                })
            })
        })

        it('delete remote', function () {
          // please note that master cannot be deleted easily
          const targetRef = 'mergable'

          const pushAllAction = new actionTypes.PushAllAction(
            testRepoSetupName,
            remoteNickName,
            false
          )

          const deleteAction = new actionTypes.PushAction(
            testRepoSetupName,
            remoteNickName,
            [`:refs/heads/${targetRef}`]
          )

          let localBranches

          return repo.branchLocal()
            .then(result => {
              localBranches = Object.keys(result.branches)
            })
            .then(() => {
              return pushAllAction.executeBy(actionExecutor)
            })
            .then(() => {
              return Promise.all([
                repo.raw(['show-ref', '-d']),
                remoteRepo.raw(['show-ref', '-d'])
              ])
                .then(results => {
                  const localRefs = parseRefs(results[0])
                  const remoteRefs = parseRefs(results[1])

                  assertRemoteUpdated(
                    localRefs,
                    remoteRefs,
                    remoteNickName,
                    localBranches
                  )
                })
            })
            .then(() => {
              return deleteAction.executeBy(actionExecutor)
            })
            .then(() => {
              return Promise.all([
                repo.raw(['show-ref', '-d']),
                remoteRepo.raw(['show-ref', '-d'])
              ])
                .then(results => {
                  const localRefs = parseRefs(results[0])
                  const remoteRefs = parseRefs(results[1])

                  chai.expect(remoteRefs.locals)
                    .to.not.have.property(targetRef)

                  chai.expect(localRefs.remotes[remoteNickName])
                    .to.not.have.property(targetRef)

                  const untouchedBranches =
                                localBranches.filter(val => {
                                  return val !== targetRef
                                })

                  assertRemoteUpdated(
                    localRefs,
                    remoteRefs,
                    remoteNickName,
                    untouchedBranches
                  )
                })
            })
        })

        it('force push single', function () {
          const targetRef = 'master'

          const action = new actionTypes.PushAction(
            testRepoSetupName,
            remoteNickName,
            [`+refs/heads/${targetRef}:refs/heads/${targetRef}`]
          )

          let localRefFirstPush
          let localRefSecondPush

          let targetBaseSha1

          return repo.revparse(['HEAD'])
            .then(result => {
              targetBaseSha1 = result.trim()
            })
            .then(() => {
              return moveBranchForward(targetRef, 'some-not-existing')
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefFirstPush = parseRefs(result)
                })
            })
            .then(() => {
              return repo.reset(['--hard', targetBaseSha1])
                .then(() => {
                  return moveBranchForward(targetRef, 'some-not-existing2')
                })
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefSecondPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                    .then(result => {
                      remoteRefs = parseRefs(result)
                    })
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefSecondPush,
                    remoteRefs,
                    remoteNickName,
                    [targetRef]
                  )

                  chai.expect(localRefFirstPush.remotes[remoteNickName][targetRef])
                    .to.not.equal(localRefSecondPush.remotes[remoteNickName][targetRef])
                })
            })
        })

        it('force push all', function () {
          const targetRefs = [
            'master',
            'mergable'
          ]

          const action = new actionTypes.PushAllAction(
            testRepoSetupName,
            remoteNickName,
            true
          )

          const targetOriginalSha = []
          let localBranches
          let localRefFirstPush
          let localRefSecondPush

          return repo.branchLocal()
            .then(result => {
              localBranches = Object.keys(result.branches)
            })
            .then(() => {
              let getSha = Promise.resolve()
              targetRefs.forEach(ref => {
                getSha = getSha.then(() => {
                  return repo.revparse([ref])
                    .then(result => {
                      targetOriginalSha.push(result.trim())
                    })
                })
              })

              return getSha
            })
            .then(() => {
              let moveTargets = Promise.resolve()

              targetRefs.forEach(ref => {
                moveTargets = moveTargets.then(() => {
                  return moveBranchForward(ref, `some-not-existing-${ref}`)
                })
              })

              return moveTargets
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefFirstPush = parseRefs(result)
                })
            })
            .then(() => {
              let moveTargets = Promise.resolve()

              targetRefs.forEach((ref, index) => {
                moveTargets = moveTargets.then(() => {
                  return repo.checkout(['-f', ref])
                    .then(() => {
                      return repo.reset(['--hard', targetOriginalSha[index]])
                    })
                    .then(() => {
                      return moveBranchForward(ref, `some-not-existing-2-${ref}`)
                    })
                })
              })

              return moveTargets
            })
            .then(() => {
              return action.executeBy(actionExecutor)
            })
            .then(() => {
              let remoteRefs

              return repo.raw(['show-ref', '-d'])
                .then(result => {
                  localRefSecondPush = parseRefs(result)
                })
                .then(() => {
                  return remoteRepo.raw(['show-ref', '-d'])
                })
                .then(result => {
                  remoteRefs = parseRefs(result)
                })
                .then(() => {
                  assertRemoteUpdated(
                    localRefSecondPush,
                    remoteRefs,
                    remoteNickName,
                    targetRefs
                  )

                  localBranches.forEach(branch => {
                    if (targetRefs.indexOf(branch) !== -1) {
                      chai.expect(localRefFirstPush.remotes[remoteNickName][branch])
                        .to.not.equal(localRefSecondPush.remotes[remoteNickName][branch])
                    } else {
                      chai.expect(localRefFirstPush.remotes[remoteNickName][branch])
                        .to.equal(localRefSecondPush.remotes[remoteNickName][branch])
                    }
                  })
                })
            })
        })

        describe('two local repos', function () {
          let anotherLocalRepo
          const anotherRepoName = 'another-local'
          const anotherWorkingPath = path.join(repoParentPath, anotherRepoName)
          let actionExecutorWithAnotherRepo

          before(function () {
            const assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor', 'resources'))

            const repoSetups = {
              [testRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, workingPath),
                '',
                '',
                REPO_TYPE.LOCAL
              ),
              [testRemoteRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, remoteWorkingPath),
                '',
                '',
                REPO_TYPE.REMOTE
              ),
              [anotherRepoName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, anotherWorkingPath),
                '',
                '',
                REPO_TYPE.LOCAL
              )
            }

            actionExecutorWithAnotherRepo = new ActionExecutor(
              utils.PLAYGROUND_PATH,
              repoStoreCollectionName,
              assetLoader,
              repoSetups
            )
          })

          beforeEach('Set Another Local', function () {
            return fs.remove(anotherWorkingPath)
              .then(() => {
                return fs.mkdtemp(repoParentPath)
              })
              .then(tempDir => {
                return zip.extractArchiveTo(
                  archivePath,
                  tempDir
                )
                  .then(() => {
                    return fs.move(
                      path.join(tempDir, repoArchiveName),
                      anotherWorkingPath
                    )
                  })
                  .then(() => {
                    return fs.remove(tempDir)
                  })
              })
              .then(() => {
                anotherLocalRepo = simpleGitCtor(anotherWorkingPath)
              })
              .then(() => {
                return wait(100)
              })
              .then(() => {
                return repo.checkout(['-f', 'master'])
              })
              .then(() => {
                return repo.clean('f', ['-d'])
              })
              .then(() => {
                const action = new actionTypes.SetRemoteAction(
                  anotherRepoName,
                  testRemoteRepoSetupName,
                  remoteNickName
                )

                return action.executeBy(actionExecutorWithAnotherRepo)
              })
          })

          describe('Fetch', function () {
            it('fetch remote', function () {
              const updateRemote = () => {
                const createCommitInAnother = () => {
                  return fs.writeFile(
                    path.join(
                      anotherWorkingPath,
                      'a.txt'
                    ),
                    'some random content that should never be able to find something alike jiofjeiocnahfi;dfjico329'
                  )
                    .then(() => {
                      return anotherLocalRepo.add([
                        'a.txt'
                      ])
                    })
                    .then(() => {
                      return anotherLocalRepo.commit(
                        'some message'
                      )
                    })
                }

                const anotherPushRemote = () => {
                  return anotherLocalRepo.push([
                    '-u',
                    remoteNickName,
                    'master'
                  ])
                }

                return createCommitInAnother()
                  .then(anotherPushRemote)
              }

              const action = new actionTypes.FetchAction(
                testRepoSetupName,
                remoteNickName
              )

              return updateRemote()
                .then(() => {
                  return action.executeBy(actionExecutorWithAnotherRepo)
                })
                .then(() => {
                  return repo.revparse(['master', `${remoteNickName}/master`])
                    .then(results => {
                      return results[0] === results[1]
                    })
                })
                .should.eventually.be.false
            })
          })
        })
      })
    })

    describe('Meta', function () {
      it('set user name & email', function () {
        const userName = 'some_random_user_name'
        const userEmail = 'some-random-email@email.com'

        const action = new actionTypes.SetUserAction(
          testRepoSetupName,
          userName,
          userEmail
        )

        return action.executeBy(actionExecutor)
          .then(() => {
            return repo.listConfig()
          })
          .then(result => {
            const configs = result.all
            return Promise.all([
              configs['user.name'].should.equal(userName),
              configs['user.email'].should.equal(userEmail)
            ])
          })
      })
    })
  })

  describe('Repository Operations', function () {
    describe('Reference and Checkpoint', function () {
      const localRefStoreName = 'compare-vcs-local-ref-' + devParams.defaultRepoStorageTypeName
      const remoteRefStoreName = `compare-vcs-remote-ref-${devParams.defaultRepoStorageTypeName}`
      const localCheckpointStoreName = 'checkpoint-store-local'
      const remoteCheckpointStoreName = 'checkpoint-store-remote'

      before('Create Specialized ActionExecutor', function () {
        const assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor/resources'))

        const repoSetups = {
          [testRepoSetupName]: new RepoVcsSetup(
            path.relative(utils.PLAYGROUND_PATH, workingPath),
            localRefStoreName,
            localCheckpointStoreName,
            REPO_TYPE.LOCAL
          ),
          [testRemoteRepoSetupName]: new RepoVcsSetup(
            path.relative(utils.PLAYGROUND_PATH, remoteWorkingPath),
            remoteRefStoreName,
            remoteCheckpointStoreName,
            REPO_TYPE.REMOTE
          )
        }

        actionExecutor = new ActionExecutor(
          utils.PLAYGROUND_PATH,
          repoStoreCollectionName,
          assetLoader,
          repoSetups
        )
      })

      before('Load Reference Store', function () {
        return fs.emptyDir(repoStoreCollectionPath)
          .then(() => {
            return zip.extractArchiveTo(
              path.join(utils.ARCHIVE_RESOURCES_PATH, localRefStoreName) + '.zip',
              path.join(repoStoreCollectionPath, localRefStoreName)
            )
          })
          .then(() => {
            return zip.extractArchiveTo(
              path.join(utils.ARCHIVE_RESOURCES_PATH, remoteRefStoreName) + '.zip',
              path.join(repoStoreCollectionPath, remoteRefStoreName)
            )
          })
      })

      beforeEach('Clean Working Directory', function () {
        return fs.emptyDir(workingPath)
          .then(() => {
            return fs.emptyDir(remoteWorkingPath)
          })
      })

      after('Clean Up', function () {
        return fs.remove(workingPath)
          .then(() => fs.remove(remoteWorkingPath))
          .then(() => fs.remove(repoStoreCollectionPath))
      })

      function assertRemoteLoaded (destination, errorLocation) {
        return Promise.all([
          fs.exists(destination),
          fs.exists(path.join(destination, 'HEAD')),
          fs.exists(path.join(destination, 'objects')),
          fs.exists(path.join(destination, 'refs'))
        ])
          .then(results => {
            return results.every(result => result === true)
          })
          .should.eventually.equal(
            true,
                    `[${errorLocation}] Should load remote repo to ${destination}, but it is not loaded`
          )
      }

      function assertLocalLoaded (destination, errorLocation) {
        return fs.exists(workingPath)
          .should.eventually.equal(
            true,
                    `[${errorLocation}] Should load local repo to ${destination}, but the destination is not shown`
          )
          .then(() => {
            return fs.exists(path.join(workingPath, '.git'))
          })
          .should.eventually.equal(
            true,
                    `[${errorLocation}] Should load local repo to ${destination}, but it seems not loaded`
          )
      };

      function pushToRemoteAndGetPsuhedRef (localWorkingPath, remoteWorkingPath) {
        const localRepo = simpleGitCtor(localWorkingPath)
        const remoteRepo = simpleGitCtor(remoteWorkingPath)

        return localRepo.init(false)
          .then(() => {
            return localRepo.addConfig('user.name', 'test')
              .then(() => {
                return localRepo.addConfig('user.email', 'test@test.ts')
              })
          })
          .then(() => {
            return remoteRepo.init(true)
          })
          .then(() => {
            return localRepo.addRemote(
              'origin',
              remoteWorkingPath
            )
          })
          .then(() => {
            return fs.writeFile(
              path.join(localWorkingPath, 'some_file'),
              'some file content'
            )
              .then(() => {
                return localRepo.add('some_file')
              })
              .then(() => {
                return localRepo.commit('some')
              })
              .then(() => {
                return localRepo.push('origin', 'master')
              })
          })
          .then(() => {
            return remoteRepo.raw(['show-ref', '-d'])
              .then(result => {
                return result.trim().split(' ')[0]
              })
          })
      }

      describe('Local', function () {
        // We don't need to verify restored cotent, it is covered by
        // repo-save-restore
        it('load reference to correct location', function () {
          const action = new actionTypes.LoadReferenceAction(
            testRepoSetupName,
            'clean'
          )

          return action.executeBy(actionExecutor)
            .then(() => {
              return assertLocalLoaded(workingPath, 'load-local-once')
            })
        })

        it('load multiple times do not break', function () {
          const actions = [
            new actionTypes.LoadReferenceAction(
              testRepoSetupName,
              'clean'
            ),
            new actionTypes.LoadReferenceAction(
              testRepoSetupName,
              'conflictResolveStage'
            ),
            new actionTypes.LoadReferenceAction(
              testRepoSetupName,
              'detached'
            )
          ]

          let execution = Promise.resolve()

          actions.forEach((action, index) => {
            execution = execution.then(() => {
              return action.executeBy(actionExecutor)
            })
              .then(() => {
                return assertLocalLoaded(workingPath, `load-multiple-${index}`)
              })
          })

          return execution
        })

        it('save and load checkpoint', function () {
          const checkpointName = 'check'

          const backupAction = new actionTypes.SaveCheckpointAction(
            testRepoSetupName,
            checkpointName
          )

          const restoreAction = new actionTypes.LoadCheckpointAction(
            testRepoSetupName,
            checkpointName
          )

          return fs.emptyDir(workingPath)
            .then(() => {
              return fs.writeFile(
                path.join(workingPath, '123'),
                'ABC',
                {
                  encoding: 'utf8'
                }
              )
            })
            .then(() => {
              return backupAction.executeBy(actionExecutor)
            })
            .then(() => {
              return fs.remove(workingPath)
            })
            .then(() => {
              return restoreAction.executeBy(actionExecutor)
            })
            .then(() => {
              return fs.readdir(workingPath)
                .should.eventually.have.length(1)
                .and.include.members(['123'])
            })
            .then(() => {
              return fs.readFile(
                path.join(workingPath, '123'),
                {
                  encoding: 'utf8'
                }
              )
                .should.eventually.equal('ABC')
            })
        })

        it('load reference then compare should be equal', function () {
          const loadAction = new actionTypes.LoadReferenceAction(
            testRepoSetupName,
            'clean'
          )

          const compareActionEqual = new actionTypes.CompareReferenceAction(
            testRepoSetupName,
            'clean'
          )

          const compareActionUnequal = new actionTypes.CompareReferenceAction(
            testRepoSetupName,
            'dirtyAdd'
          )

          return loadAction.executeBy(actionExecutor)
            .then(() => {
              return compareActionEqual.executeBy(actionExecutor)
            })
            .should.eventually.equal(true)
            .then(() => {
              return compareActionUnequal.executeBy(actionExecutor)
            })
            .should.eventually.equal(false)
        })
      })

      describe('Remote', function () {
        it('load reference to correct location', function () {
          const action = new actionTypes.LoadReferenceAction(
            testRemoteRepoSetupName,
            'init-remote'
          )

          return action.executeBy(actionExecutor)
            .then(() => {
              return assertRemoteLoaded(remoteWorkingPath, 'load reference once')
            })
        })

        it('load multiple times do not break', function () {
          const actions = [
            new actionTypes.LoadReferenceAction(
              testRemoteRepoSetupName,
              'update-master-only'
            ),

            new actionTypes.LoadReferenceAction(
              testRemoteRepoSetupName,
              'force-update-master'
            ),

            new actionTypes.LoadReferenceAction(
              testRemoteRepoSetupName,
              'push-master'
            )
          ]

          let execution = Promise.resolve()

          actions.forEach((action, index) => {
            execution = execution.then(() => {
              return action.executeBy(actionExecutor)
                .then(() => {
                  return assertRemoteLoaded(remoteWorkingPath, `remote-multiple-${index}`)
                })
            })
          })

          return execution
        })

        it('save and load checkpoint', function () {
          this.timeout(3000)

          const checkpointName = 'check'

          const backupActions = [
            new actionTypes.SaveCheckpointAction(
              testRepoSetupName,
              checkpointName
            ),
            new actionTypes.SaveCheckpointAction(
              testRemoteRepoSetupName,
              checkpointName
            )
          ]

          const restoreActions = [
            new actionTypes.LoadCheckpointAction(
              testRepoSetupName,
              checkpointName
            ),
            new actionTypes.LoadCheckpointAction(
              testRemoteRepoSetupName,
              checkpointName
            )
          ]

          const executeActions = (actions) => {
            let execution = Promise.resolve()
            actions.forEach(action => {
              execution = execution.then(() => {
                return action.executeBy(actionExecutor)
              })
            })

            return execution
          }

          let pushedRef
          return pushToRemoteAndGetPsuhedRef(
            workingPath,
            remoteWorkingPath
          )
            .then(result => {
              pushedRef = result
            })
            .then(() => {
              return executeActions(backupActions)
            })
            .then(() => {
              return fs.remove(workingPath)
                .then(() => {
                  return fs.remove(remoteWorkingPath)
                })
            })
            .then(() => {
              return executeActions(restoreActions)
            })
            .then(() => {
              return fs.readFile(
                path.join(
                  remoteWorkingPath,
                  'refs',
                  'heads',
                  'master'
                ),
                {
                  encoding: 'utf8'
                }
              )
                .then(result => {
                  chai.expect(result.trim()).equal(pushedRef)
                })
            })
        })

        it('load reference then compare should be equal', function () {
          const loadAction = new actionTypes.LoadReferenceAction(
            testRemoteRepoSetupName,
            'add-second-branch-to-conflict-mixed'
          )

          const compareActionEqual = new actionTypes.CompareReferenceAction(
            testRemoteRepoSetupName,
            'add-second-branch-to-conflict-mixed'
          )

          const compareActionUnequal = new actionTypes.CompareReferenceAction(
            testRemoteRepoSetupName,
            'change-tag-name'
          )

          return loadAction.executeBy(actionExecutor)
            .then(() => {
              return compareActionEqual.executeBy(actionExecutor)
            })
            .should.eventually.equal(true)
            .then(() => {
              return compareActionUnequal.executeBy(actionExecutor)
            })
            .should.eventually.equal(false)
        })
      })
    })
  })
})

module.exports.parseRefs = parseRefs
module.exports.assertRemoteUpdated = assertRemoteUpdated
