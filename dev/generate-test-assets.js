'use strict'

const path = require('path')
const fs = require('fs-extra')
const yaml = require('js-yaml')
const AssetIndex = require('../src/main/asset-loader').AssetIndex

const collectIndexPaths = function (basePath) {
  const results = []
  const stack = []
  stack.push(basePath)
  while (stack.length !== 0) {
    const currentPath = stack.pop()
    const children = fs.readdirSync(currentPath)

    children.forEach(c => {
      const childPath = path.join(currentPath, c)

      if (c.endsWith('-index.yaml')) {
        results.push(childPath)
      } else if (fs.statSync(childPath).isDirectory()) {
        stack.push(childPath)
      }
    })
  }

  return results
}

/**
 *
 * @param {AssetIndex} index
 */
const collectAssetNamePairsFromIndex = function (index) {
  const assetNamePairs = []
  if (index.mode === 'infile') {
    return assetNamePairs
  } else {
    const assets = index.assets
    Object.keys(assets).forEach(key => {
      assetNamePairs.push({ key: key, assetName: assets[key] })
    })

    return assetNamePairs
  }
}

function generateAssetAtPath (assetPath, key) {
  return fs.writeFile(assetPath, key)
}

/**
 *
 * @param {string} basePath
 * @param {Array<Object>} assetNames
 */
function generateAssets (basePath, assetNamePairs) {
  const generateAssetPromises = []

  generateAssetPromises.push(
    fs.ensureDir(basePath)
  )

  assetNamePairs.forEach(assetNamePair => {
    const assetPath = path.join(basePath, assetNamePair.assetName)

    generateAssetPromises.push(
      fs.exists(assetPath)
        .then(isExist => {
          if (!isExist) {
            return fs.writeFile(assetPath, `content of ${assetNamePair.key}`)
          }
        })
    )
  })

  return Promise.all(generateAssetPromises)
}

const generateAssetsForIndex = function (indexPath, bundlePathElements) {
  return fs.readFile(indexPath)
    .then(content => {
      return yaml.safeLoad(content)
    })
    .then(obj => {
      return new AssetIndex(obj, bundlePathElements)
    })
    .then(index => {
      return collectAssetNamePairsFromIndex(index)
    })
    .then(assetNamePairs => {
      const parsed = path.parse(indexPath)
      const assetBasePath = path.join(parsed.dir, parsed.name.replace('-index', ''))

      return generateAssets(
        assetBasePath,
        assetNamePairs
      )
    })
}

module.exports.generateTestAssets = function (rootPath, bundlePathElements) {
  const basePath = path.join(...[rootPath].concat(bundlePathElements))
  const indexPaths = collectIndexPaths(basePath)

  const generateAssetsForIndexPromides = []
  indexPaths.forEach(indexPath => {
    generateAssetsForIndexPromides.push(
      generateAssetsForIndex(indexPath, bundlePathElements)
    )
  })

  return Promise.all(generateAssetsForIndexPromides)
}
