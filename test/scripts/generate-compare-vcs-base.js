'use strict';

const fs = require('fs-extra');
const path = require('path');
const zip = require('../../lib/simple-archive');
const utils = require('../tests/test-utils');
const generateBaseRepo = require('../../dev/generate-base-repo').generateBaseRepo;

const STORAGE_TYPE = require('../../lib/repo-vcs').STORAGE_TYPE;


const workingPath = path.resolve(__dirname, '../playground/generate-repo');
const resoruceBasePath = path.resolve(__dirname, '../resources');

const assetStorePath = path.join(resoruceBasePath, 'vcs-compare', 'assets');

/**
 * @typedef executionContext
 * @type {Object}
 * @property {string} yamlSubPath
 * @property {Object} repoNameToWorkingPathArchiveName
 * @property {Object} repoNameToRefArchiveName
 */

const executionContexts = [
    {
        yamlSubPath: path.join('vcs-compare', 'generate-base-repo.yaml'),
        repoNameToWorkingPathArchiveName: {
            local: 'compare-vcs'
        },
        repoNameToRefArchiveName: {
            local: 'compare-vcs-grow-local-ref'
        }
    },
    {
        yamlSubPath: path.join('vcs-compare', 'generate-testing-ref-repo.yaml'),
        repoNameToWorkingPathArchiveName: {},
        repoNameToRefArchiveName: {
            local: 'compare-vcs-local-ref'
        }
    }
];

const storageTypes = [
    STORAGE_TYPE.ARCHIVE,
    STORAGE_TYPE.GIT
];

let execution = Promise.resolve();

executionContexts.forEach(executionContext => {
    storageTypes.forEach(storageType => {

        execution = execution.then(() => {
            return generateBaseRepo(
                workingPath,
                assetStorePath,
                path.join(resoruceBasePath, executionContext.yamlSubPath),
                utils.ARCHIVE_RESOURCES_PATH,
                {
                    repoStorageType: storageType
                }
            )
            .then(repoSetups => {
                let postProcess = Promise.resolve();

                Object.keys(repoSetups).forEach(repoSetupName => {
                    let setup = repoSetups[repoSetupName];
                    let workingPathArchiveName =
                        executionContext.repoNameToWorkingPathArchiveName[repoSetupName];

                    if (workingPathArchiveName) {
                        let destination = path.join(
                            utils.ARCHIVE_RESOURCES_PATH,
                            workingPathArchiveName + '.zip'
                        );

                        postProcess = postProcess.then(() => {
                            return fs.remove(destination)
                            .then(() => {
                                return zip.archivePathTo(
                                    setup.fullWorkingPath,
                                    destination,
                                    false
                                )
                            });
                        });
                    }

                    let refArchiveName =
                        executionContext.repoNameToRefArchiveName[repoSetupName];

                    if (refArchiveName) {
                        let destination = path.join(
                            utils.ARCHIVE_RESOURCES_PATH,
                            `${refArchiveName}-${STORAGE_TYPE.toString(storageType)}.zip`
                        );

                        postProcess = postProcess.then(() =>{
                            return fs.remove(destination)
                            .then(() => {
                                return zip.archivePathTo(
                                    setup.fullReferenceStorePath,
                                    destination
                                );
                            });
                        });
                    }
                });
            })
            .then(() => {
                return fs.remove(workingPath);
            });
        })
    })
})



