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
            if (c.endsWith("-index.yaml")) {
                results.push(path.join(currentPath, c));
            }
            stack.push(path.join(currentPath, c));
        });
    }

    return results;
}

/**
 * 
 * @param {AssetIndex} index 
 */
const collectAssetNamesFromIndex = function(index) {

    let assetNames = [];
    if (index.mode === "infile") {
        return assetNames;
    }
    else{
        let assets = index.assets;
        Object.keys(assets).forEach(key => {
            assetNames.push(assets[key]);
        });

        return assetNames;
    }
}

/**
 * 
 * @param {string} basePath 
 * @param {Array<string>} assetNames 
 */
function generateAssets(basePath, assetNames) {

}

const generateAssetsForIndex = function(indexPath) {
    return fs.readFile(indexPath)
    .then(content => {
        return yaml.safeLoad(content);
    })
    .then(obj => {
        return new AssetIndex(obj);
    })
    .then(index => {
        return collectAssetNamesFromIndex(index);
    })
    .then(assetNames => {

    });
}

module.exports.generateTestAssets = function(rootPath, bundlePathElements) {
    let basePath = path.join(...[rootPath].concat(bundlePathElements));
    let indexPaths = collectIndexPaths(basePath);
    let generateAssetsFor
}