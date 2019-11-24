'use strict';

const fs = require('fs-extra');
const path = require('path');
const AssetLoader = require('../lib/asset-loader').AssetLoader;
const devRunner = require('./dev-runner');
const zip = require('../lib/simple-archive');

const fileSystemBasePath = path.resolve(__dirname, '../bake');

let args = process.argv.slice(2);

let projectPath = path.resolve(__dirname, '../');

operate(args)
.catch(err => {
    console.error(err);
});

function operate(args) {
    switch(args[0]) {
        case 'bake-course':
            if (args[1] === 'help' || args.length === 1) {
                console.log(`
    bake-course: bake for a course
      arguments:
        resourcePathEncoded: path to resource loaded by AssetLoader. Formed in format BASE_PATH+BUNDLE/PATH/ELEMENTS
        courseAssetId: asset id of the baked course
        sourceRepoStorePath: path to repo store that is used to bake the course`);
                return Promise.resolve();
            }

            let resourcePathEncoded = args[1];
            let levelAssetId = args[2];
            let sourceRepoStorePath = normalizePath(args[3]);

            let resourcePathTokens = resourcePathEncoded.replace('\\', '/').split('+');
            let resourcePath = normalizePath(resourcePathTokens[0]);
            let bundlePaths = 
                resourcePathTokens[1] === '' ?
                [] :
                resourcePathTokens[1].split('/');
            let initRepoStoreArchivePath = path.join(resourcePath, 'archives', 'init-repo-store');

            return fs.emptyDir(fileSystemBasePath)
            .then(() => {
                return fs.copy(
                    sourceRepoStorePath,
                    initRepoStoreArchivePath
                );
            })
            .then(() => {
                let assetLoader = new AssetLoader(resourcePath);
                assetLoader.setBundlePath(...bundlePaths);

                return assetLoader.getFullAssetPath(levelAssetId)
                .then(configPath => {
                    return devRunner.run(
                        configPath,
                        fileSystemBasePath,
                        'repo-stores',
                        assetLoader
                    );
                });
            })
            .then(() => {
                let repoStorePath = path.join(fileSystemBasePath, 'repo-stores');
                var archivesPath = path.join(fileSystemBasePath, 'repo-archives');
                return fs.readdir(repoStorePath, { withFileTypes: true })
                .then(dirents => {
                    let archives = Promise.resolve();
                    dirents.forEach(dirent => {
                        if (dirent.isDirectory()) {
                            archives = archives.then(() => {
                                return zip.archivePathTo(
                                    path.join(repoStorePath, dirent.name),
                                    path.join(archivesPath, dirent.name + '.zip'),
                                    false
                                );
                            });
                        }
                    });

                    return archives;
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
      bake-course <resourcePathEncoded> <levelAssetId> <sourceRepoStorePath>: bake for a course`);
}

function normalizePath(pathValue) {
    if (path.isAbsolute(pathValue)) {
        return pathValue;
    }
    else {
        return path.join(projectPath, pathValue);
    }
}