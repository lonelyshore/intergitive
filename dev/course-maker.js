'use strict';

const fs = require('fs-extra');
const path = require('path');
const AssetLoader = require('../lib/asset-loader').AssetLoader;
const devRunner = require('./dev-runner');

const fileSystemBasePath = path.resolve(__dirname, '../bake');

let args = process.argv.slice(2);

operate(args)
.catch(err => {
    console.error(err);
});

function operate(args) {
    switch(args[0]) {
        case 'bake-level':
            if (args[1] === 'help' || args.length === 1) {
                console.log(`
    bake-level: bake for a level
      arguments:
        resourcePathEncoded: path to resource loaded by AssetLoader. Formed in format BASE_PATH|BUNDLE/PATH/ELEMENTS
        levelAssetId: asset id of the baked level
        sourceRepoStorePath: path to repo store that is used to bake the level`);
                return Promise.resolve();
            }

            let resourcePathEncoded = args[1];
            let levelAssetId = args[2];
            let sourceRepoStorePath = args[3];

            let resourcePathTokens = resourcePathEncoded.split('|')[0];
            let resourcePath = resourcePathTokens[0];
            let bundlePaths = resourcePathTokens[1].split('/');

            let repoStorePathSubPath = 'repo-store';

            return fs.emptyDir(fileSystemBasePath)
            .then(() => {
                let repoStorePath = path.join(fileSystemBasePath, repoStorePathSubPath);
                return fs.copy(
                    sourceRepoStorePath,
                    repoStorePath
                );
            })
            .then(() => {
                let assetLoader = new AssetLoader(resourcePath);
                assetLoader.setBundlePath(bundlePaths);

                return assetLoader.loadTextContent(levelAssetId)
                .then(configPath => {
                    return devRunner.run(
                        configPath,
                        fileSystemBasePath,
                        repoStorePathSubPath,
                        assetLoader
                    );
                });
            });

        default:
            printUsage();
            return Promise.reject(new Error(`Unexpected arguments: ${args.join(', ')}`));
    }
}

function printUsage() {
    console.log(`
    Usage:
      bake-level <resourcePathEncoded> <levelAssetId> <sourceRepoStorePath>: bake for a level`);
}