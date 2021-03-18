'use strict'

const fs = require('fs-extra')
const path = require('path')

const args = process.argv.slice(2)
const cachePath = path.resolve(__dirname, '../.module_cache')
const configPath = path.join(cachePath, '.config')
const modulePath = path.resolve(__dirname, '../node_modules')

wrapper(args)
  .catch(err => {
    console.error(err)
  })

function wrapper (args) {
  switch (args[0]) {
    case 'save':
      return saveModule(args[1], args[2])

    case 'load':
      return loadModule(args[1], args[2])

    case 'drop':
      if (args.length === 3) {
        return dropModuleEnvironment(args[1])
      } else {
        return dropModule(args[1])
      }

    case 'init':
      return fs.ensureDir(cachePath)
        .then(() => {
          return fs.exists(configPath)
        })
        .then(configExists => {
          if (!configExists) {
            return fs.writeFile(configPath, '{}')
          }
        })

    case 'ls':
      return listModules()

    case 'which':
      return printWhichModule(args[1])

    case 'versions':
      return listModuleVersions(args[1])

    case 'help':
      printUsage()
      return Promise.resolve()

    default:
      printUsage()
      return Promise.reject(new Error('Unexcepted arguments: ' + args.join(', ')))
  }
}

function printUsage () {
  console.log(`
  Usage:
    save <module> <environment>: cache a module environment for later use
    load <module> <environment>: load a previously saved module environment, and set it to be active
    drop <module> [environment]: remove all cached module environments, 
                                 or when [environment] is provided, remove the specified environment
    ls: list all cached modules and their current environment
    which <module>: show the active environment for the module
    versions <module>: list all available environments for the module. Active environment is marked by "*"
    help: show this help info`)
}

function saveModule (moduleName, envName) {
  const storePath = path.join(cachePath, moduleName, envName)
  const sourcePath = path.join(modulePath, moduleName)
  return fs.emptyDir(storePath)
    .then(() => {
      return fs.copy(sourcePath, storePath)
    })
    .then(() => {
      return updateConfig(moduleName, '.system.')
    })
}

function loadModule (moduleName, envName) {
  const storePath = path.join(cachePath, moduleName, envName)
  const targetPath = path.join(modulePath, moduleName)
  return whichModuleVersion(moduleName)
    .then(currentVersion => {
      if (currentVersion === envName) {
        console.log(`Not loading ${envName} for ${moduleName} because it is current version`)
        return Promise.resolve()
      } else {
        return fs.emptyDir(targetPath)
          .then(() => {
            return fs.copy(storePath, targetPath)
          })
          .then(() => {
            return updateConfig(moduleName, envName)
          })
      }
    })
}

function dropModuleEnvironment (moduleName, envName) {
  const storePath = path.join(cachePath, moduleName, envName)
  return fs.remove(storePath)
    .then(() => {
      return fs.readFile(configPath)
        .then(configRaw => {
          const config = JSON.parse(configRaw)
          const currentEnv = config[moduleName]
          if (currentEnv && currentEnv === envName) {
            config[currentEnv] = '.system.'
          }

          return JSON.stringify(config)
        })
        .then(configRaw => {
          return fs.writeFile(configPath, configRaw)
        })
    })
}

function dropModule (moduleName) {
  return fs.remove(path.join(cachePath, moduleName))
    .then(() => {
      return fs.readFile(configPath)
        .then(configRaw => {
          const config = JSON.parse(configRaw)
          if (config[moduleName]) {
            delete config[moduleName]
          }

          return JSON.stringify(config)
        })
        .then(configRaw => {
          return fs.writeFile(configPath, configRaw)
        })
    })
}

function listModules () {
  return fs.readFile(configPath)
    .then(configRaw => {
      const config = JSON.parse(configRaw)
      Object.keys(config).forEach(moduleName => {
        printModuleVersion(moduleName, config[moduleName])
      })
    })
}

function printWhichModule (moduleName) {
  return whichModuleVersion(moduleName)
    .then(version => {
      printModuleVersion(moduleName, version)
    })
}

function listModuleVersions (moduleName) {
  const modulePath = path.join(cachePath, moduleName)
  return fs.exists(modulePath)
    .then(exists => {
      if (exists) {
        let currentVersion
        return whichModuleVersion(moduleName)
          .then(version => currentVersion = version)
          .then(() => fs.readdir(modulePath))
          .then(envNames => {
            envNames.forEach(envName => {
              if (currentVersion === envName) {
                console.log('* ' + envName)
              } else {
                console.log('  ' + envName)
              }
            })
          })
      } else {
        console.log('not installed')
      }
    })
}

function whichModuleVersion (moduleName) {
  return fs.readFile(configPath)
    .then(configRaw => {
      const config = JSON.parse(configRaw)
      return config[moduleName]
    })
}

function printModuleVersion (moduleName, moduleVersion) {
  console.log(`${moduleName}: ${moduleVersion || 'not installed'}`)
}

function updateConfig (moduleName, envName) {
  return fs.readFile(configPath)
    .then(configRaw => {
      const config = JSON.parse(configRaw)
      config[moduleName] = envName
      return JSON.stringify(config)
    })
    .then(configRaw => {
      fs.writeFile(configPath, configRaw)
    })
}
