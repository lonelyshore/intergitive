'use strict';

const fs = require('fs-extra');
const path = require('path');
const AssetLoader = require('../src/main/asset-loader').AssetLoader;
const devRunner = require('./dev-runner');
const loadCourseAsset = require('../src/main/load-course-asset');
const RuntimeCourseSettings = require('../src/main/runtime-course-settings');
const zip = require('../src/main/simple-archive');
const { ApplicationConfig } = require('../src/common/config-app');
const populateAssetBundles = require('./poppulate-asset-index');

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
            return bakeCourse(args);

        case 'populate-asset':
            if (args[1] === 'help' || args.length !== 4) {
                console.log(`
        populate-asset: populate asset IDs from source to target
        arguments:
        loaderBasePath: path to folder where asset loader will be initialized
        sourceBundlePaths: path tokens of source asset bundle. Please join the tokens with '/' into a string.
        targetBundlePaths: path tokens of source asset bundle. Please join the tokens with '/' into a string.`);
                return Promise.resolve();
            }
            return populateAssetBundles(
                path.isAbsolute(args[1]) ? args[1] : path.join(projectPath, args[1]),
                args[2].split('/'),
                args[3].split('/')
            );

        default:
            printUsage();
            return Promise.reject(new Error(`Unexpected arguments: ${args.join(', ')}`));
    }
}

function printUsage() {
    console.log(`
    Usage:
      bake-course <relativeBasePath> <language> <selectedCourse> <sourceRepoStorePath>: bake for a course
      populate-asset <loaderBasePath> <sourceBundlePaths> <targetBundlePaths>: populate asset IDs from source to target`);
}

function bakeCourse(args) {
    if (args[1] === 'help' || args.length !== 5) {
        console.log(`
bake-course: bake for a course
arguments:
relativeBasePath: path to folder where common assets (resources) and course asset folder (course-resources) located
language: target language code
selectedCourse: asset id of the baked course, without "course/" prefix
sourceRepoStorePath: path to repo store that is used to bake the course`);
        return Promise.resolve();
    }

    let settings = new RuntimeCourseSettings(
        projectPath,
        args[1],
        new ApplicationConfig(
            args[2],
            args[3]
        )
    );

    let loaderPair = loadCourseAsset.createCourseAssetLoaderPair(settings);
    
    let sourceRepoStorePath = normalizePath(args[4]);

    let initRepoStoreArchivePath = path.join(settings.courseResourcesPath, settings.course, 'archives', 'init-repo-store');

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
        return devRunner.run(
            settings.course,
            settings.language,
            fileSystemBasePath,
            'repo-stores',
            loaderPair
        );
    })
    .then(() => {
        let repoStorePath = path.join(fileSystemBasePath, 'repo-stores');
        var archivesPath = path.join(fileSystemBasePath, 'generated-repo-archives');
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
}

function normalizePath(pathValue) {
    if (path.isAbsolute(pathValue)) {
        return pathValue;
    }
    else {
        return path.join(projectPath, pathValue);
    }
}