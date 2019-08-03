'use strict';

const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git/promise');
const zip = require('../../lib/simple-archive');
const utils = require('../tests/test-utils');
const generateBaseRepo = require('../../dev/generate-base-repo').generateBaseRepo;

const SAVE_TYPE = require('../../dev/generate-base-repo').SAVE_TYPE;
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
 * @property {Array<SAVE_TYPE>} saveTypes
 */

const executionContexts = [
    // Growing base repo.
    // Generate working path final state archive
    // and per-stage archive-type repo refs
    {
        yamlSubPath: path.join('vcs-compare', 'generate-base-repo.yaml'),
        repoNameToWorkingPathArchiveName: {
            local: 'compare-vcs'
        },
        repoNameToRefArchiveName: {
            local: 'compare-vcs-grow-local-ref'
        },
        saveTypes: [
            SAVE_TYPE.ARCHIVE,
        ]
    },
    // Growing base repo.
    // Generate per-stage git-type repo refs
    {
        yamlSubPath: path.join('vcs-compare', 'generate-base-repo.yaml'),
        repoNameToWorkingPathArchiveName: {},
        repoNameToRefArchiveName: {
            local: 'compare-vcs-grow-local-ref'
        },
        saveTypes: [
            SAVE_TYPE.GIT,
        ]
    },
    // Diverge from base repo.
    // Generate per-stage archive- and repo-type repo refs
    {
        yamlSubPath: path.join('vcs-compare', 'generate-testing-ref-repo.yaml'),
        repoNameToWorkingPathArchiveName: {},
        repoNameToRefArchiveName: {
            local: 'compare-vcs-local-ref'
        },
        repoNameToPerStageSnapshotName: {
            local: 'compare-vcs-local-ref-per-stage'
        },
        saveTypes: [
            SAVE_TYPE.ARCHIVE,
            SAVE_TYPE.GIT,
            SAVE_TYPE.SNAPSHOT
        ]
    }
];

function getSaveTypeString(saveType) {
    switch(saveType) {
        case SAVE_TYPE.SNAPSHOT:
            return 'snapshot';
        default:
            return STORAGE_TYPE.toString(saveType);
    }
}

let execution = Promise.resolve();

executionContexts.forEach(executionContext => {
    executionContext.saveTypes.forEach(saveType => {

        let options = {};

        options.saveType = saveType;

        execution = execution.then(() => {

            return generateBaseRepo(
                workingPath,
                assetStorePath,
                path.join(resoruceBasePath, executionContext.yamlSubPath),
                utils.ARCHIVE_RESOURCES_PATH,
                options
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
                            `${refArchiveName}-${getSaveTypeString(saveType)}.zip`
                        );

                        postProcess = postProcess.then(() =>{
                            return fs.remove(destination)
                            .then(() => {
                                return zip.archivePathTo(
                                    setup.fullReferenceStorePath,
                                    destination,
                                    false
                                );
                            });
                        });
                    }
                });

                return postProcess;
            })
            .catch(err => {
                console.error(`Error happend when executing ${executionContext.yamlSubPath} & ${getSaveTypeString(saveType)}`);
                console.error(err);
            })
            .finally(() => {
                return fs.remove(workingPath);
            })

        })
    })
});

// Create local repo edge cases
execution = execution.then(() =>{
    let workingPath = path.join(utils.PLAYGROUND_PATH, 'create-test-data');
    let repoPath = path.join(workingPath, 'init');
    return fs.emptyDir(repoPath)
    .then(() => {
        return simpleGit(repoPath)
    })
    .then(repo => {
        return repo.raw(['init'])
        .then(() => {
            return repo.raw(['config', '--local', 'user.name', 'test-repo']);
        })
        .then(() => {
            return repo.raw(['config', '--local', 'user.email', 'test-repo@some.mail.server']);
        })
        .then(() => {
            return repo.raw(['config', '--local', 'core.autocrlf', 'input']);
        });
    })
    .then(() => {
        return zip.archivePathTo(
            repoPath,
            repoPath + '.zip',
            false
        )
        .then(() => {
            return fs.remove(repoPath);
        })
        .then(() => {
            return zip.archivePathTo(
                workingPath,
                path.join(utils.ARCHIVE_RESOURCES_PATH, 'local-repo-edgecases.zip'),
                false
            );
        });
    })
    .then(() => {
        return fs.remove(workingPath);
    });
})


