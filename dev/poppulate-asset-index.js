/**
 * This scripts populates asset IDs found in soruce bundle into target bundle.
 * When a index in target bundle does not have a default fallback or the default fallback is source bundle,
 * the newly added asset IDs will be put into default fallback.
 * When the index has a default fallback that is NOT source bundle,
 * the newly added asset IDs will be redirect to source bundle via redirect fallback.
 */

'use strict'

const fs = require('fs-extra')
const path = require('path')
const assert = require('assert')

const yaml = require('js-yaml')

const { getAllFilesRecursive } = require('../test/tests/test-utils')

class PopulatedIndex {
  constructor (assetIndex, populatedKeys) {
    this.assetIndex = assetIndex
    this.populatedKeys = populatedKeys
  }
}

function collectAssetIds (rawIndex) {
  let keys = []
  if (rawIndex.ondisk) {
    keys = keys.concat(Object.keys(rawIndex.ondisk))
  }
  if (rawIndex.infile) {
    keys = keys.concat(Object.keys(rawIndex.infile))
  }
  if ('fallbacks' in rawIndex) {
    const fallbacks = rawIndex.fallbacks
    if ('default' in fallbacks) {
      let defaults = fallbacks.default
      if (!Array.isArray(defaults)) defaults = [defaults]

      defaults.forEach(defaultSetting => {
        assert(defaultSetting.keys !== null && Array.isArray(defaultSetting.keys))
        keys = keys.concat(defaultSetting.keys)
      })
    }
    if (fallbacks.redirects) {
      keys = keys.concat(Object.keys(fallbacks.redirects))
    }
  }

  return keys
}

/**
 *
 * @param {Array<string>} sourceBundlePaths
 * @param {Array<string>} targetBundlePaths
 * @param {Object} rawTargetIndex
 * @returns {insertFallbackCb}
 */
function createInsertToFallbackCb (sourceBundlePaths, targetBundlePaths, rawTargetIndex) {
  if ('fallbacks' in rawTargetIndex && 'default' in rawTargetIndex.fallbacks) {
    let defaultSetting = rawTargetIndex.default

    if (Array.isArray(defaultSetting)) {
      defaultSetting = defaultSetting[0]
    }

    assert(
      defaultSetting.path_replacement &&
            Array.isArray(defaultSetting.path_replacement) &&
            defaultSetting.path_replacement.length === targetBundlePaths.length
    )

    const redirectTokens = createRedirectTokens(
      targetBundlePaths,
      sourceBundlePaths
    )

    return (newKey, fallbacks) => {
      const redirects = fallbacks.redirects || {}
      redirects[newKey] = redirectTokens

      fallbacks.redirects = redirects
    }
  } else {
    return (newKey, fallbacks) => {
      if (!('default' in fallbacks)) {
        fallbacks.default = [{
          path_replacement: createRedirectTokens(targetBundlePaths, sourceBundlePaths),
          keys: []
        }]
      }

      if (!Array.isArray(fallbacks.default)) {
        fallbacks.default = [fallbacks.default]
      }

      fallbacks.default[0].keys.push(newKey)
    }
  }

  function createRedirectTokens (redirectSourceTokens, redirectDestinationTokens) {
    assert(redirectSourceTokens.length === redirectDestinationTokens.length)

    return redirectSourceTokens.map((sourceToken, index) => {
      const destinationToken = redirectDestinationTokens[index]
      if (sourceToken === destinationToken) {
        return ''
      } else {
        return destinationToken
      }
    })
  }
}

/**
 * A callback used to inject new key into fallbacks
 * @callback insertFallbackCb
 * @param {String} newKey
 * @param {Object} fallbacks
 */

/**
 *
 * @param {Object} rawSourceIndex
 * @param {Object} rawTargetIndex
 * @param {insertFallbackCb} insertFallbackCb
 * @returns {PopulatedIndex}
 */
function populateIndex (rawSourceIndex, rawTargetIndex, insertFallbackCb) {
  const sourceKeys = collectAssetIds(rawSourceIndex)
  const targetKeySet = new Set(collectAssetIds(rawTargetIndex))

  const addedKeys = []
  const rawNewIndex = JSON.parse(JSON.stringify(rawTargetIndex)) // lazy deep clone...
  const newFallback = rawNewIndex.fallbacks || {}

  sourceKeys.forEach(sourceKey => {
    if (!targetKeySet.has(sourceKeys)) {
      addedKeys.push(sourceKey)
      insertFallbackCb(sourceKey, newFallback)
    }
  })

  rawNewIndex.fallbacks = newFallback

  return new PopulatedIndex(
    rawNewIndex,
    addedKeys
  )
}

/**
 *
 * @param {string} assetLoaderBasePath
 * @param {Array<string>} sourceBundlePaths
 * @param {Array<string>} targetBundlePaths
 * @param {string} indexRelativePath
 * @returns {Array<string>} the newly added keys
 */
function createOrPopulateIndex (assetLoaderBasePath, sourceBundlePaths, targetBundlePaths, indexRelativePath) {
  return Promise.all([
    fs.readFile(path.join(assetLoaderBasePath, ...sourceBundlePaths, indexRelativePath))
      .then(content => yaml.load(content))
      .then(obj => obj.asset_index),

    fs.readFile(path.join(assetLoaderBasePath, ...targetBundlePaths, indexRelativePath))
      .then(content => yaml.load(content))
      .then(obj => obj.asset_index)
      .catch(() => { return {} })
  ])
    .then(indices => {
      return populateIndex(
        indices[0],
        indices[1],
        createInsertToFallbackCb(
          sourceBundlePaths,
          targetBundlePaths,
          indices[1]
        )
      )
    })
    .then(populatedIndex => {
      const filePath = path.join(assetLoaderBasePath, ...targetBundlePaths, indexRelativePath)

      return fs.ensureFile(filePath)
        .then(() => fs.writeFile(
          filePath,
          yaml.dump({ asset_index: populatedIndex.assetIndex })
        ))
        .then(() => populatedIndex.populatedKeys)
    })
}

/**
 *
 * @param {string} assetLoaderBasePath
 * @param {string} bundlePaths
 * @returns {Array<string>} returns relative paths to index files founded
 */
function listIndices (assetLoaderBasePath, bundlePaths) {
  const bundleFullPath = path.join(assetLoaderBasePath, ...bundlePaths)

  return getAllFilesRecursive(bundleFullPath, () => true)
    .then(filePaths => {
      return filePaths.filter(filePath => filePath.endsWith('-index.yaml'))
        .map(filePath => path.relative(bundleFullPath, filePath))
    })
}

function populateAssetBundles (assetLoaderBasePath, sourceBundlePaths, targetBundlePaths) {
  return fs.ensureDir(path.join(assetLoaderBasePath, ...targetBundlePaths))
    .then(() => listIndices(assetLoaderBasePath, sourceBundlePaths))
    .then(indexFileRelativePaths => {
      console.log(`Totally ${indexFileRelativePaths.length} files to process`)

      let populatedKeys = []

      const thread = indexFileRelativePaths.reduce(
        (thread, indexFileRelativePath) => {
          return thread.then(() => createOrPopulateIndex(
            assetLoaderBasePath,
            sourceBundlePaths,
            targetBundlePaths,
            indexFileRelativePath
          ))
            .then(newlyAddedKeys => {
              const keysWithFile = newlyAddedKeys.map(key => path.basename(indexFileRelativePath) + key)
              populatedKeys = populatedKeys.concat(keysWithFile)

              console.log(`Processed ${indexFileRelativePath}`)
            })
            .catch(err => {
              console.error(err)
            })
        },
        Promise.resolve()
      )

      return thread.then(() => populatedKeys)
    })
    .then(populatedKeys => {
      console.log('All files populated')
      return fs.writeFile('populatedKeys', yaml.dump(populatedKeys))
    })
}

module.exports = populateAssetBundles
