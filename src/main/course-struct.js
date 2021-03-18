'use strict'
const path = require('path')

class CourseStruct {
  constructor (projectPath, baseRelativePath) {
    this.projectPath = projectPath
    this.basePath = path.join(projectPath, baseRelativePath)
  }

  get resourcesPath () {
    return path.join(this.basePath, 'resources')
  }

  get courseResourcesPath () {
    return path.join(this.basePath, 'course-resources')
  }

  get executionPath () {
    return path.join(this.basePath, 'execution')
  }

  get appConfigPath () {
    return this.executionPath
  }

  get playgroundPath () {
    return path.join(this.executionPath, 'playground')
  }

  get progressPath () {
    return path.join(this.executionPath, 'progress')
  }

  get repoStoreCollectionName () {
    return 'repo-stores'
  }
}

module.exports = CourseStruct
