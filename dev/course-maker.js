'use strict'

const fs = require('fs-extra')
const path = require('path')
const devRunner = require('./dev-runner')
const loadCourseAsset = require('../src/main/load-course-asset')
const CourseStruct = require('../src/main/course-struct')
const zip = require('../src/main/simple-archive')
const populateAssetBundles = require('./poppulate-asset-index')

const fileSystemBasePath = path.resolve(__dirname, '../bake')

const args = process.argv.slice(2)

const projectPath = path.resolve(__dirname, '../')

operate(args)
  .catch(err => {
    console.error(err)
  })

function operate (args) {
  switch (args[0]) {
    case 'bake-course':
      return bakeCourse(args)

    case 'populate-asset':
      if (args[1] === 'help' || args.length !== 4) {
        console.log(`
        populate-asset: populate asset IDs from source to target
        arguments:
        loaderBasePath: path to folder where asset loader will be initialized
        sourceBundlePaths: path tokens of source asset bundle. Please join the tokens with '/' into a string.
        targetBundlePaths: path tokens of source asset bundle. Please join the tokens with '/' into a string.`)
        return Promise.resolve()
      }
      return populateAssetBundles(
        path.isAbsolute(args[1]) ? args[1] : path.join(projectPath, args[1]),
        args[2].split('/'),
        args[3].split('/')
      )

    default:
      printUsage()
      return Promise.reject(new Error(`Unexpected arguments: ${args.join(', ')}`))
  }
}

function printUsage () {
  console.log(`
    Usage:
      bake-course <relativeBasePath> <language> <selectedCourse> <sourceRepoStorePath>: bake for a course
      populate-asset <loaderBasePath> <sourceBundlePaths> <targetBundlePaths>: populate asset IDs from source to target`)
}

function bakeCourse (args) {
  if (args[1] === 'help' || args.length !== 5) {
    console.log(`
bake-course: bake for a course
arguments:
relativeBasePath: path to folder where common assets (resources) and course asset folder (course-resources) located
language: target language code
selectedCourse: asset id of the baked course, without "course/" prefix
sourceRepoStorePath: path to repo store that is used to bake the course`)
    return Promise.resolve()
  }

  const courseStruct = new CourseStruct(
    projectPath,
    args[1]
  )

  const courseName = args[2]
  const language = args[3]

  const loaderPair = loadCourseAsset.createCourseAssetLoaderPair(courseStruct)

  const sourceRepoStorePath = normalizePath(args[4])

  const initRepoStoreArchivePath = path.join(courseStruct.courseResourcesPath, courseName, 'archives', 'init-repo-store')

  return fs.emptyDir(fileSystemBasePath)
    .then(() => {
      return fs.ensureDir(initRepoStoreArchivePath)
        .then(() => {
          return fs.copy(
            sourceRepoStorePath,
            initRepoStoreArchivePath
          )
        })
    })
    .then(() => {
      return devRunner.run(
        courseName,
        language,
        fileSystemBasePath,
        'repo-stores',
        loaderPair
      )
    })
    .then(() => {
      const repoStorePath = path.join(fileSystemBasePath, 'repo-stores')
      const archivesPath = path.join(fileSystemBasePath, 'generated-repo-archives')
      return fs.readdir(repoStorePath, { withFileTypes: true })
        .then(dirents => {
          let archives = Promise.resolve()
          dirents.forEach(dirent => {
            if (dirent.isDirectory()) {
              archives = archives.then(() => {
                return zip.archivePathTo(
                  path.join(repoStorePath, dirent.name),
                  path.join(archivesPath, dirent.name + '.zip')
                )
              })
            }
          })

          return archives
        })
    })
}

function normalizePath (pathValue) {
  if (path.isAbsolute(pathValue)) {
    return pathValue
  } else {
    return path.join(projectPath, pathValue)
  }
}
