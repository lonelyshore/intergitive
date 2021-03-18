'use strict'

const fs = require('fs-extra')
const path = require('path')
const { ApplicationConfig } = require('../common/config-app')
const configName = 'app-config.json'

function createDefaultConfig () {
  return new ApplicationConfig(
    'zh-Hant',
    'git-extensions'
  )
}

class AppConfigService {
  /**
     *
     * @param {string} configDirName
     * @param {module:main/course-struct~CourseStruct} courseStruct
     */
  constructor (configDirName, courseStruct) {
    this.configDirName = configDirName
    this.courseStruct = courseStruct
  }

  get configurationPath () {
    return path.join(this.configDirName, configName)
  }

  /**
     * @returns {ApplicationConfig} returns configuration. If not exists, create one.
     */
  loadConfiguration () {
    return fs.readFile(this.configurationPath)
      .then(content => {
        const obj = JSON.parse(content)
        Object.setPrototypeOf(obj, ApplicationConfig)
        return obj
      })
      .catch(() => { // simply ignores error
        const defaultConfig = createDefaultConfig()

        return this.saveConfiguration(defaultConfig)
          .then(() => defaultConfig)
      })
  }

  /**
     * This method is for development only.
     * @returns {ApplicationConfig}
     */
  loadConfigurationSync () {
    let obj
    try {
      const content = fs.readFileSync(this.configurationPath)
      obj = JSON.parse(content)
      Object.setPrototypeOf(obj, ApplicationConfig)
    } catch (error) {
      obj = createDefaultConfig()
    }

    return obj
  }

  /**
     *
     * @param {ApplicationConfig} config The configuration to be serialized
     */
  saveConfiguration (config) {
    return fs.writeFile(
      this.configurationPath,
      JSON.stringify(config)
    )
  }

  listCourseAndLanguageOptions () {
    const courses = {}
    return fs.readdir(
      this.courseStruct.courseResourcesPath,
      { withFileTypes: true })
      .then(dirents => {
        const scanCourses = dirents.reduce(
          (previous, dirent) => {
            if (dirent.isDirectory()) {
              const courseName = dirent.name
              previous = previous.then(() =>
                scanCourse(this.courseStruct, courseName))
                .then(langs => {
                  courses[courseName] = langs
                })
            }

            return previous
          },
          Promise.resolve()
        )

        return scanCourses
      })
      .then(() => courses)

    function scanCourse (courseStruct, courseName) {
      return fs.readdir(
        path.join(
          courseStruct.courseResourcesPath,
          courseName
        ),
        { withFileTypes: true }
      )
        .then(dirents => {
          return dirents.reduce(
            (previous, dirent) => {
              if (dirent.isDirectory()) {
                previous.push(dirent.name)
              }
              return previous
            },
            []
          )
        })
    }
  }
}

module.exports.AppConfigService = AppConfigService
