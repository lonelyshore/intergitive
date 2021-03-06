'use strict'

/**
 * @module main/asset-loader
 */

const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')
const assert = require('assert')

const indexCache = Symbol('indexCache')
const loadIndex = Symbol('loadIndex')
const retrieveValueFromIndex = Symbol('retrieveValueFromIndex')
const bundlePathWalked = Symbol('bundlePathWalked')
const handleError = Symbol('HandleError')
const INFILE_SOURCE = Symbol('infile')
const ONDISK_SOURCE = Symbol('ondisk')

const { typeCheck } = require('../common/utility')

function calculateRedirect (currentBundleTokens, redirectBundleTokens) {
  const mergedTokens = currentBundleTokens.map((element, index) => {
    return redirectBundleTokens[index] !== null && redirectBundleTokens[index] !== '' ? redirectBundleTokens[index] : element
  })

  return mergedTokens.join(path.sep)
}

function parseAssetPath (assetPath) {
  const parsed = path.parse(assetPath)
  return {
    get assetName () {
      return parsed.base
    },

    get containerSubPath () {
      return parsed.dir
    }
  }
}

/**
 *
 * @param {IndexedResult} indexedResult
 * @param {string} loaderRootPath
 * @param {string} bundlePath
 */
function getIndexedAssetFullPath (indexedResult, loaderRootPath, containerSubPath) {
  return path.join(loaderRootPath, indexedResult.assetBundlePath, containerSubPath, indexedResult.assetContent)
}

class AssetIndex {
  /**
     *
     * @param {Object} obj
     * @param {string} bundlePath
     */
  constructor (obj, bundlePath) {
    assert('asset_index' in obj, '[AssetIndex] asset_index missing')

    const indexBody = obj.asset_index

    assert(indexBody !== undefined && indexBody !== null && indexBody instanceof Object, 'asset_index is empty')

    // mode
    assert(!('mode' in indexBody), '[AssetIndex] mode is deprecated')

    // assets
    this.infile = indexBody.infile || {}
    this.ondisk = indexBody.ondisk || {}

    assert(
      this.infile instanceof Object && !Array.isArray(this.infile),
      '[AssetIndex] expect infile section to be a map'
    )

    assert(
      this.ondisk instanceof Object && !Array.isArray(this.ondisk),
      '[AssetIndex] expect ondisk section to be a map'
    )

    // fallbacks
    const fallbacks = {}
    if ('fallbacks' in indexBody) {
      const bundleTokens = bundlePath.split(path.sep).filter(element => {
        return element !== null && element !== ''
      })

      const fallbacksSource = indexBody.fallbacks
      assert(fallbacksSource instanceof Object, '[AssetIndex] expect fallbackSource to be a map')

      if ('default' in fallbacksSource) {
        let defaultSettings = fallbacksSource.default

        if (!Array.isArray(defaultSettings)) {
          defaultSettings = [defaultSettings]
        }

        defaultSettings.forEach(defaultSetting => {
          assert('path_replacement' in defaultSetting, '[AssetIndex] path_replacement missing')
          assert(Array.isArray(defaultSetting.path_replacement), '[AssetIndex] expect path_replacement to be an array')
          assert(defaultSetting.path_replacement.length === bundleTokens.length, '[AssetIndex] expect path_replacement have same length as bundleTokens')

          defaultSetting.path_replacement.forEach(element => {
            assert(typeCheck.isString(element))
          })

          const defaultRedirect = calculateRedirect(bundleTokens, defaultSetting.path_replacement)

          assert('keys' in defaultSetting, '[AssetIndex] keys missing')

          const keys = defaultSetting.keys
          assert(Array.isArray(keys), '[AssetIndex] expect keys to be an array')
          keys.forEach(element => {
            assert(typeCheck.isString(element))
            if (element in fallbacks) console.error(`Duplicated fallback element for key ${element}`)
            fallbacks[element] = defaultRedirect
          })
        })
      }

      if ('redirects' in fallbacksSource) {
        const redirects = fallbacksSource.redirects
        assert(redirects instanceof Object && !Array.isArray(redirects), '[AssetIndex] redirects missing')
        Object.keys(redirects).forEach(key => {
          const value = redirects[key]
          assert(Array.isArray(value))
          assert(value.length === bundleTokens.length)
          value.forEach(element => {
            assert(typeCheck.isString(element))
          })

          const redirect = calculateRedirect(
            bundleTokens,
            value
          )

          if (key in fallbacks) console.error(`Duplicated fallback element for key ${key}`)
          fallbacks[key] = redirect
        })
      }
    }

    this.fallbacks = fallbacks
  }
}

class NotFoundError extends Error {
  constructor (startingContainerPath, finalContainerPath, assetName) {
    super(`Failed to find ${assetName}, given the beginning source bundle path ${startingContainerPath} and last valid bundle path ${finalContainerPath}`)

    this.startingContainerPath = startingContainerPath
    this.finalContainerPath = finalContainerPath
    this.assetName = assetName
  }
}

class CyclicFallbackError extends Error {
  constructor (startingContainerPath, assetName) {
    super(`Cyclic fallback detected for loading ${assetName} from ${startingContainerPath}`)

    this.startingContainerPath = startingContainerPath
    this.assetName = assetName
  }
}

class InternalNotFoundError extends Error {
  constructor () {
    super('NotFound')
  }
}

class InternalCyclicFallbackError extends Error {
  constructor () {
    super('CyclicFallback')
  }
}

class IndexedResult {
  /**
     *
     * @param {string} assetContent
     * @param {sring} assetBundlePath
     * @param {*} source
     */
  constructor (assetContent, assetBundlePath, source) {
    this.assetContent = assetContent
    this.assetBundlePath = assetBundlePath
    this.source = source
  }
}

/**
 * @class
 */
class AssetLoader {
  constructor (rootPath, ...pathElements) {
    assert(path.isAbsolute(rootPath), `expect rootPath ${rootPath} to be absolute`)

    this.rootPath = rootPath
    this[indexCache] = {}
    this[bundlePathWalked] = []

    if (!pathElements || pathElements.length === 0) {
      this.bundlePath = ''
      this.bundlePathElements = []
    } else {
      this.bundlePathElements = pathElements
      this.bundlePath = path.join(...pathElements)
    }
  }

  getLoaderForBundlePath (...pathElements) {
    return new AssetLoader(
      this.rootPath,
      ...pathElements
    )
  }

  /**
     *
     * @param {string} assetPath
     * @returns {Promise<boolean>}
     */
  containsAsset (assetPath) {
    return Promise.resolve()
      .then(() => {
        const parsedPath = parseAssetPath(assetPath)
        this[bundlePathWalked].length = 0

        return this[retrieveValueFromIndex](this.bundlePath, parsedPath)
          .then(() => {
            return true
          })
          .catch(err => {
            if (err instanceof InternalNotFoundError || err instanceof InternalCyclicFallbackError) {
              return false
            }
          })
      })
  }

  /**
     *
     * @param {string} assetPath
     * @return {Promise<any>}
     */
  getFullAssetPath (assetPath) {
    const parsedPath = parseAssetPath(assetPath)
    this[bundlePathWalked].length = 0

    return this[retrieveValueFromIndex](this.bundlePath, parsedPath)
      .then(indexedResult => {
        if (indexedResult.source === ONDISK_SOURCE) {
          return getIndexedAssetFullPath(indexedResult, this.rootPath, parsedPath.containerSubPath)
        } else {
          throw new InternalNotFoundError()
        }
      })
      .catch(err => {
        this[handleError](err, parsedPath)
      })
  }

  /**
     *
     * @param {string} assetPath
     * @returns {Promise<string>} text content
     */
  loadTextContent (assetPath, encoding) {
    encoding = encoding || 'utf8'

    const parsedPath = parseAssetPath(assetPath)
    this[bundlePathWalked].length = 0

    return this[retrieveValueFromIndex](
      this.bundlePath,
      parsedPath,
      INFILE_SOURCE
    )
      .then(indexedResult => {
        if (indexedResult.source === INFILE_SOURCE) {
          return indexedResult.assetContent
        } else {
          return Promise.resolve(
            getIndexedAssetFullPath(
              indexedResult,
              this.rootPath,
              parsedPath.containerSubPath
            )
          )
            .then(fullAssetPath => {
              return fs.readFile(fullAssetPath, encoding)
            })
        }
      })
      .catch(err => {
        this[handleError](err, parsedPath)
      })
  }

  /**
     * @param {string} containerPath
     * @param {string} bundlePath
     * @returns {Promise<AssetIndex>}
     */
  [loadIndex] (containerPath, bundlePath) {
    const containerFullPath = path.join(
      this.rootPath,
      containerPath
    )

    const parsed = path.parse(containerFullPath)
    const indexName = parsed.name + '-index.yaml'
    const indexPath = path.join(parsed.dir, indexName)

    if (fs.existsSync(indexPath)) {
      return fs.readFile(indexPath)
        .then(content => yaml.safeLoad(content))
        .then(obj => new AssetIndex(obj, bundlePath))
    } else {
      return Promise.reject(new InternalNotFoundError())
    }
  }

  /**
     *
     * @param {string} bundlePath
     * @param {Object} assetPath
     * @returns {IndexedResult}
     */
  [retrieveValueFromIndex] (bundlePath, parsedAssetPath) {
    this[bundlePathWalked].push(bundlePath)
    const containerPath = path.join(bundlePath, parsedAssetPath.containerSubPath)

    let index = this[indexCache][containerPath]
    let readIndex
    if (index === undefined) {
      readIndex = () => {
        return this[loadIndex](containerPath, bundlePath)
          .then(indexResult => {
            index = indexResult
            this[indexCache][containerPath] = index
            return indexResult
          })
      }
    } else {
      readIndex = () => Promise.resolve(index)
    }

    const assetName = parsedAssetPath.assetName
    return readIndex()
      .then(indexResult => {
        if (assetName in indexResult.infile) {
          return new IndexedResult(
            indexResult.infile[assetName],
            bundlePath,
            INFILE_SOURCE
          )
        } else if (assetName in indexResult.ondisk) {
          return new IndexedResult(
            indexResult.ondisk[assetName],
            bundlePath,
            ONDISK_SOURCE
          )
        } else if (assetName in indexResult.fallbacks) {
          const newBundlePath = indexResult.fallbacks[assetName]
          if (this[bundlePathWalked].includes(newBundlePath)) {
            throw new InternalCyclicFallbackError()
          } else {
            return this[retrieveValueFromIndex](newBundlePath, parsedAssetPath)
          }
        } else {
          throw new InternalNotFoundError()
        }
      })
  }

  [handleError] (err, parsedPath) {
    if (err instanceof InternalNotFoundError) {
      throw new NotFoundError(
        path.join(this.bundlePath, parsedPath.containerSubPath),
        path.join(this[bundlePathWalked].pop(), parsedPath.containerSubPath),
        parsedPath.assetName
      )
    } else if (err instanceof InternalCyclicFallbackError) {
      throw new CyclicFallbackError(
        path.join(this.bundlePath, parsedPath.containerSubPath),
        parsedPath.assetName
      )
    } else {
      throw err
    }
  }
}

/**
 * @deprecated
 */
class MutableAssetLoader extends AssetLoader {
  /**
     * @param {...string} pathElements
     */
  setBundlePath (...pathElements) {
    if (!pathElements || pathElements.length === 0) {
      this.bundlePath = ''
      this.bundlePathElements = []
    } else {
      this.bundlePathElements = pathElements
      this.bundlePath = path.join(...pathElements)
    }
  }
}

module.exports.AssetIndex = AssetIndex
module.exports.AssetLoader = AssetLoader
module.exports.MutableAssetLoader = MutableAssetLoader
module.exports.NotFoundError = NotFoundError
module.exports.CyclicFallbackError = CyclicFallbackError
