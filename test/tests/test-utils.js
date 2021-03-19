'use strict'

const fs = require('fs-extra')
const path = require('path')
const simpleGit = require('simple-git/promise')
const random = require('seedrandom')

const eol = require('../../src/common/text-eol')
const normalizePathSep = require('../../src/main/noarmalize-path-sep')

const resourcesPath = path.resolve(__dirname, '../resources')

const rng = random('seed')

function generateConfigSummary (workingPath) {
  const repo = simpleGit(workingPath)

  return repo.raw(['config', '--local', '--list'])
    .then(result => {
      if (!result) {
        return []
      } else {
        return result.split('\n').filter(v => {
          return !v.toLowerCase().startsWith('user.name') &&
                    !v.toLowerCase().startsWith('user.email') &&
                    v.trim()
        })
          .sort()
      }
    })
}

function generateRepoHistorySummary (workingPath) {
  const repo = simpleGit(workingPath)

  const refCommits = []

  return repo.raw(['show-ref', '-d', '--head'])
    .then(result => {
      if (result) {
        const lines = result.split('\n')
        lines.forEach(line => {
          if (line !== null && line.length !== 0) {
            refCommits.push(line)
          }
        })
      }
    })
    .then(() => {
      refCommits.sort()
    })
    .then(() => {
      return refCommits
    })
}

function generateIndexDiffSummary (workingPath) {
  const repo = simpleGit(workingPath)

  const diffs = []
  return repo.raw(['diff-index', '--cached', 'HEAD'])
    .then(result => {
      if (result) {
        const lines = result.split('\n')
        lines.forEach(line => {
          if (line !== null && line.length !== 0) {
            const tokens = line.split('\t')
            const filename = tokens[1]
            const diff = tokens[0]
            diffs.push(`${filename} ${diff}`)
          }
        })
      }
    })
    .then(() => {
      diffs.sort()
    })
    .then(() => {
      return diffs
    })
}

function getRepoStatus (workingPath) {
  const repo = simpleGit(workingPath)

  return repo.raw(['status'])
}

function getAllFilesRecursive (currentPath, shouldExplore) {
  let results = []

  return fs.readdir(currentPath, { withFileTypes: true })
    .then(dirents => {
      const children = []

      dirents.forEach(dirent => {
        const childPath = path.join(currentPath, dirent.name)
        if (dirent.isDirectory()) {
          if (shouldExplore(currentPath, dirent.name)) {
            children.push(
              getAllFilesRecursive(childPath, shouldExplore)
            )
          }
        } else {
          results.push(childPath)
        }
      })

      return Promise.all(children)
    })
    .then(childrenResults => {
      childrenResults.forEach(childResults => {
        results = results.concat(childResults)
      })

      return results
    })
}

function generateWorktreeSummary (workingPath) {
  const repo = simpleGit(workingPath)
  const summary = []

  return getAllFilesRecursive(
    workingPath,
    (currentPath, name) => {
      return name !== '.git'
    }
  )
    .then(files => {
      files.forEach((file, index) => {
        files[index] =
                normalizePathSep.posix(path.relative(workingPath, file))
      })

      return files
    })
    .then(files => {
      const calcHashes = []

      files.forEach(file => {
        calcHashes.push(
          repo.raw(['hash-object', file])
            .then(result => {
              summary.push(`${file} ${result}`)
            })
        )
      })

      return Promise.all(calcHashes)
    })
    .then(() => {
      summary.sort()
    })
    .then(() => {
      return summary
    })
}

function areGitRepoSame (first, second, isVerbose) {
  let isRepositoryEmpty = false

  const checkHistorySame = () => {
    return Promise.all([
      generateRepoHistorySummary(first),
      generateRepoHistorySummary(second)
    ])
      .then(summaries => {
        if (summaries[0].length === 0) {
          isRepositoryEmpty = true
        }
        return compareSummaries(summaries, 'RepoHistory', isVerbose)
      })
  }

  const checkConfigsSame = () => {
    return Promise.all([
      generateConfigSummary(first),
      generateConfigSummary(second)
    ])
      .then(summaries => {
        return compareSummaries(summaries, 'RepoConfig', isVerbose)
      })
  }

  return checkConfigsSame()
    .then(configSame => {
      if (!configSame) {
        throw new Error('breaking')
      }
    })
    .then(() => {
      return checkHistorySame()
    })
    .then(isHistorySame => {
      if (isHistorySame) {
        if (isRepositoryEmpty) {
          return true
        } else {
          return Promise.all([
            generateIndexDiffSummary(first),
            generateIndexDiffSummary(second)
          ])
            .then(summaries => {
              return compareSummaries(summaries, 'RepoIndex', isVerbose)
            })
            .then(indexSame => {
              if (!indexSame) {
                throw new Error('breaking')
              }
            })
            .then(() => {
              return Promise.all([
                getRepoStatus(first),
                getRepoStatus(second)
              ])
            })
            .then(statuses => {
              const areStatusesSame = statuses[0] === statuses[1]
              if (!areStatusesSame && isVerbose) {
                console.log('[RepoStatus] repos have different "git status" result')
              }
              return areStatusesSame
            })
        }
      } else {
        return false
      }
    })
    .catch(err => {
      if (err === 'breaking') {
        return false
      } else {
        console.error(err, err.stack)
        return false
      }
    })
}

function compareSummaries (summaries, kind, isVerbose) {
  if (summaries.length !== 2) {
    if (isVerbose) { console.log(`[${kind}] summaries should have length of 2`) }
    return false
  }

  const firstSummary = summaries[0]
  const secondSummary = summaries[1]

  if (firstSummary.length !== secondSummary.length) {
    if (isVerbose) { console.log(`[${kind}] have different number of entries`) }
    return false
  }

  for (let i = 0; i < firstSummary.length; i++) {
    const firstEntry = firstSummary[i]
    const secondEntry = secondSummary[i]

    if (firstEntry !== secondEntry) {
      if (isVerbose) { console.log(`[${kind}] have at least one different entry`) }
      return false
    }
  }

  return true
}

function areWorkingTreeSame (first, second, isVerbose) {
  return Promise.all([
    generateWorktreeSummary(first),
    generateWorktreeSummary(second)
  ])
    .then(summaries => {
      return compareSummaries(summaries, 'WorkTree', isVerbose)
    })
}

function areBareRepoSame (first, second, isVerbose) {
  return Promise.all([
    generateRepoHistorySummary(first),
    generateRepoHistorySummary(second)
  ])
    .then(summaries => {
      return compareSummaries(summaries, 'RepoHistory', isVerbose)
    })
}

function isBareRepo (testedPath) {
  const mandatoryFileSet = {
    HEAD: ''
  }
  const mandatoryFolderSet = {
    objects: '',
    refs: ''
  }

  return fs.readdir(testedPath, { withFileTypes: true })
    .then(dirents => {
      let isBare = false

      dirents.forEach(dirent => {
        if (isBare) { return }

        if (dirent.isDirectory()) {
          if (dirent.name in mandatoryFolderSet) {
            delete mandatoryFolderSet[dirent.name]
          }
        } else if (dirent.isFile()) {
          if (dirent.name in mandatoryFileSet) {
            delete mandatoryFileSet[dirent.name]
          }
        }

        if (Object.getOwnPropertyNames(mandatoryFileSet).length === 0 &&
            Object.getOwnPropertyNames(mandatoryFolderSet).length === 0) {
          isBare = true
        }
      })

      return isBare
    })
}

function areDirectorySame (firstDir, secondDir, isVerbose) {
  isVerbose = isVerbose || false

  return Promise.all([
    fs.pathExists(path.join(firstDir, '.git')),
    fs.pathExists(path.join(secondDir, '.git'))
  ])
    .then(areGitRepos => {
      if (areGitRepos.every(value => value === true)) {
        return areGitRepoSame(firstDir, secondDir, isVerbose)
          .then(areSame => {
            if (areSame) {
              return areWorkingTreeSame(firstDir, secondDir, isVerbose)
            } else {
              return false
            }
          })
      } else if (areGitRepos.every(value => value === false)) {
        return Promise.all([
          isBareRepo(firstDir),
          isBareRepo(secondDir)
        ])
          .then(areBareRepos => {
            if (areBareRepos.every(value => value === true)) {
              return areBareRepoSame(firstDir, secondDir, isVerbose)
            } else {
              return areWorkingTreeSame(firstDir, secondDir, isVerbose)
            }
          })
      } else {
        if (isVerbose) {
          console.log('One is git repo but the other is not')
        }
        return false
      }
    })
}

function inplaceShuffle (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const randomIndex = Math.abs(rng.int32()) % (i + 1) // floor([0, i]
    const swap = array[i]
    array[i] = array[randomIndex]
    array[randomIndex] = swap
  }

  return array
}

/**
 *
 * @param {string} target
 */
function randomConvert (target) {
  function getEolRandomly () {
    const val = rng.quick()
    if (val < 0.333) {
      return '\n'
    } else if (val < 0.666) {
      return '\r'
    } else {
      return '\r\n'
    }
  }

  if (!eol.eolReg.test(target)) {
    return target
  }

  const lines = target.split(eol.eolReg)

  let ret = lines[0]
  lines.slice(1).forEach(line => {
    ret += getEolRandomly() + line
  })

  return ret
}

module.exports.PROJECT_PATH = path.join(__dirname, '../../')
module.exports.PLAYGROUND_PATH = path.resolve(__dirname, '../playground')
module.exports.RESOURCES_PATH = resourcesPath
module.exports.ARCHIVE_RESOURCES_PATH = path.join(resourcesPath, 'repo-archive')
module.exports.notImplemented = function () { throw new Error('Not Implemented') }
module.exports.areDirectorySame = areDirectorySame
module.exports.inplaceShuffle = inplaceShuffle
module.exports.eolToRandom = randomConvert
module.exports.RepoArchiveConfigExecutor = require('../../dev/repo-generation-config-executor').RepoGenerationConfigExecutor
module.exports.getAllFilesRecursive = getAllFilesRecursive
