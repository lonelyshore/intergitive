'use strict'

const yaml = require('js-yaml')
const loadCourseAsset = require('../src/main/load-course-asset')
const LEVEL_SCHEMA = require('./level-config-schema').LEVEL_CONFIG_SCHEMA

class DevLoaderPair extends loadCourseAsset.LoaderPair {
  loadLevelFromCourse (levelName, courseName, language) {
    const loader = this.getCourseLoader(courseName, language)

    return loader.loadTextContent(levelName)
      .then(text => {
        console.log(`loading ${levelName} json`)
        return yaml.safeLoad(text, { schema: LEVEL_SCHEMA })
      })
  }
}

module.exports = Object.assign(module.exports, loadCourseAsset)
module.exports.createCourseAssetLoaderPair = (courseSettings) => {
  const loaderPair = loadCourseAsset.createCourseAssetLoaderPair(
    courseSettings
  )
  return new DevLoaderPair(loaderPair.global, loaderPair.course)
}
