"use strict";

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const AssetIndex = require("../lib/asset-loader").AssetIndex;

const collectIndexPaths = function(basePath) {
    let results = [];
    let stack = [];
    stack.push(basePath);
    while (stack.length !== 0) {
        let currentPath = stack.pop();
        let children = fs.readdirSync(currentPath);

        children.forEach(c => {
            let childPath = path.join(currentPath, c);

            if (c.endsWith("-index.yaml")) {
                results.push(childPath);
            }
            else if (fs.statSync(childPath).isDirectory()) {
                stack.push(childPath);
            }
        });
    }

    return results;
}

/**
 * 
 * @param {AssetIndex} index 
 */
const collectAssetNamePairsFromIndex = function(index) {

    let assetNamePairs = [];
    if (index.mode === "infile") {
        return assetNamePairs;
    }
    else{
        let assets = index.assets;
        Object.keys(assets).forEach(key => {
            assetNamePairs.push({ key: key, assetName: assets[key] });
        });

        return assetNamePairs;
    }
}

function generateAssetAtPath(assetPath, key) {
    return fs.writeFile(assetPath, key);
}

/**
 * 
 * @param {string} basePath 
 * @param {Array<Object>} assetNames 
 */
function generateAssets(basePath, assetNamePairs) {
    let generateAssetPromises = [];

    generateAssetPromises.push(
        fs.ensureDir(basePath)
    );

    assetNamePairs.forEach(assetNamePair => {
        let assetPath = path.join(basePath, assetNamePair.assetName);

        generateAssetPromises.push(
            fs.exists(assetPath)
            .then(isExist => {
                if (!isExist) {
                    return fs.writeFile(assetPath, assetNamePair.key)
                }
            })
        );
    });

    return Promise.all(generateAssetPromises);
}

const generateAssetsForIndex = function(indexPath, bundlePathElements) {
    return fs.readFile(indexPath)
    .then(content => {
        return yaml.safeLoad(content);
    })
    .then(obj => {
        return new AssetIndex(obj, bundlePathElements);
    })
    .then(index => {
        return collectAssetNamePairsFromIndex(index);
    })
    .then(assetNamePairs => {
        let parsed = path.parse(indexPath);
        let assetBasePath = path.join(parsed.dir, parsed.name.replace("-index", ""));

        return generateAssets(
            assetBasePath,
            assetNamePairs
        );
    });
}

module.exports.generateTestAssets = function(rootPath, bundlePathElements) {
    let basePath = path.join(...[rootPath].concat(bundlePathElements));
    let indexPaths = collectIndexPaths(basePath);

    let generateAssetsForIndexPromides = [];
    indexPaths.forEach(indexPath => {
        generateAssetsForIndexPromides.push(
            generateAssetsForIndex(indexPath, bundlePathElements)
        );
    });

    return Promise.all(generateAssetsForIndexPromides);
}