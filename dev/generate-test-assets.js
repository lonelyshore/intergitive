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

function generateAssetAtPath(assetPath) {
    return fs.writeFile(assetPath, path.basename(assetPath));
}

/**
 * 
 * @param {string} basePath 
 * @param {Array<string>} assetNames 
 */
function generateAssets(basePath, assetNames) {
    let generateAssetPromises = [];

    generateAssetPromises.push(
        fs.ensureDir(basePath)
    );

    assetNames.forEach(assetName => {
        let assetPath = path.join(basePath, assetName);

        generateAssetPromises.push(
            fs.exists(assetPath)
            .then(isExist => {
                if (!isExist) {
                    return generateAssetAtPath(assetPath);
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
        return collectAssetNamesFromIndex(index);
    })
    .then(assetNames => {
        let parsed = path.parse(indexPath);
        let assetBasePath = path.join(parsed.dir, parsed.name.replace("-index"));

        return generateAssets(
            assetBasePath,
            assetNames
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