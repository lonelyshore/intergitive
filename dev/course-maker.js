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
        commonResourcePath: path to resource folder where common assets and course definition files located
        courseResourcePath: path to course resources loaded by AssetLoader
        courseAssetId: asset id of the baked course, without "course/" prefix
        sourceRepoStorePath: path to repo store that is used to bake the course`);
                return Promise.resolve();
            }

            let commonResourcePath = normalizePath(args[1]);
            let courseResourcePath = normalizePath(args[2]);
            let courseAssetId = args[3];
            let sourceRepoStorePath = normalizePath(args[4]);

            let initRepoStoreArchivePath = path.join(courseResourcePath, courseAssetId, 'archives', 'init-repo-store');

            return fs.emptyDir(fileSystemBasePath)
            .then(() => {
                return fs.ensureDir(initRepoStoreArchivePath)
                .then(() => {
                    return fs.copy(
                        sourceRepoStorePath,
                        initRepoStoreArchivePath
                    );
                });
            })
            .then(() => {
                let commonAssetLoader = new AssetLoader(commonResourcePath);
                let baseCourseAssetLoader = new AssetLoader(courseResourcePath);

                return commonAssetLoader.getFullAssetPath(`course/${courseAssetId}`)
                .then(configPath => {
                    let courseAssetLoader = baseCourseAssetLoader.getLoaderForBundlePath(courseAssetId);

                    return devRunner.run(
                        configPath,
                        fileSystemBasePath,
                        'repo-stores',
                        courseAssetLoader
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
                                    path.join(archivesPath, dirent.name + '.zip')
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
      bake-course <commonResourcePath> <courseResourcePath> <courseAssetId> <sourceRepoStorePath>: bake for a course`);
}

function normalizePath(pathValue) {
    if (path.isAbsolute(pathValue)) {
        return pathValue;
    }
    else {
        return path.join(projectPath, pathValue);
    }
}