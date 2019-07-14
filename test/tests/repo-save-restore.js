"use strict";

const path = require("path");
const fs = require("fs-extra");
const assert = require('assert');
const utils = require("./test-utils");


const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const zip = require("../../lib/simple-archive");
const vcs = require("../../lib/repo-vcs");

const ActionExecutor = require("../../dev/action-executor").DevActionExecutor;
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const RepoSetup = require("../../lib/config-level").RepoVcsSetup;

chai.use(chaiAsPromised);
chai.should();

const testdataName = 'compare-vcs-version-archives';
const testdataBasePath =
    path.join(utils.PLAYGROUND_PATH, 'testdata');
const testdataPath =
    path.join(testdataBasePath, testdataName);
const testingStorageTypes = [
    vcs.STORAGE_TYPE.ARCHIVE,
    // vcs.STORAGE_TYPE.GIT
];

describe.only('Prepare Repo Save & Restore Tests', function() {

    after('Clean up playground', function() {
        return fs.remove(utils.PLAYGROUND_PATH);
    });

    testingStorageTypes.forEach(testingStorageType => {
        it.skip(`GENERATE TESTS ${testingStorageType}`, function() {

            let testdataEntryNames = [];
    
            return fs.emptyDir(utils.PLAYGROUND_PATH)
            .then(() => {
                return fs.emptyDir(testdataBasePath)
            })
            .then(() => {
                return zip.extractArchiveTo(
                    path.join(utils.ARCHIVE_RESOURCES_PATH, testdataName) + '.zip',
                    testdataBasePath
                );
            })
            .then(() => {
                return fs.readdir(testdataPath)
                .then(childNames => {
                    childNames.forEach(childName => {
                        if (childName.endsWith('.zip')) {
                            testdataEntryNames.push(childName.replace(/\.zip$/, ''));
                        }
                    });
                });
            })
            .then(() => {
                createTests(testdataEntryNames, testingStorageType);
            });
        });

        it(`GENERATE NEW TESTS - ${testingStorageType}`, function() {
            createNewTests(testingStorageType);
        })
    })


})

function createNewTests(testingStorageType) {

    const perSuiteResourcePath = path.join(utils.PLAYGROUND_PATH, 'test-save-and-restore-relate-resources');
    const createdRepoName = 'repo';

    const repoCreationPath = path.join(perSuiteResourcePath, 'created-repo', createdRepoName);

    const repoReplacementPath = path.join(perSuiteResourcePath, 'repo-replacement');
    const repoCreationConfigPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-base-repo.yaml");
    
    const testUnitWorkingPath = path.join(utils.PLAYGROUND_PATH, 'working-path');
    const testUnitRepoReplayPath = path.join(testUnitWorkingPath, 'repo-replay', createdRepoName);
    const testUnitRepoRestorePath = path.join(testUnitWorkingPath, 'restored');

    function createRepoCreationActionExecutor(createdRepoPath) {

        assert(createdRepoPath.endsWith(createdRepoName));

        let assetLoader = new AssetLoader(
            path.join(utils.RESOURCES_PATH, "vcs-compare", "assets")
        );

        assetLoader.setBundlePath();

        let repoSetups = {
            repo: new RepoSetup(
                createdRepoName,
                undefined,
                undefined
            )
        };

        return new ActionExecutor(
            path.resolve(createdRepoPath, '../'),
            assetLoader,
            repoSetups
        );
    }

    const repoCreationConfigExecutor = new utils.RepoArchiveConfigExecutor();

    const repoCreationConfig = repoCreationConfigExecutor.loadConfigSync(
        repoCreationConfigPath
    );

    function buildRepoAndSave(stageNames, stageMap, repoCreationPath, saver) {

        let repoCreationActionExecutor = createRepoCreationActionExecutor(
            repoCreationPath
        );

        let executions = Promise.resolve();

        stageNames.forEach(stageName => {
            executions = executions.then(() => {
                return repoCreationConfigExecutor.executeStage(stageName, stageMap, repoCreationActionExecutor);
            })
            .then(() => {
                return saver(stageName);
            });
        });

        return executions;
    }

    /**
     * 
     * @param {Array<string>} stageNames 
     * @param {Object} stageMap 
     * @param {String} finalStageName 
     * @param {String} repoCreationPath 
     */
    function buildRepoUpTo(stageNames, stageMap, finalStageName, repoCreationPath) {
        let subStageNames = [];
        for (var i = 0; i < stageNames.length; i++) {
            let stageName = stageNames[i];
            
            subStageNames.push(stageNames[i]);

            if (stageName === finalStageName) {
                break;
            }
        }

        return buildRepoAndSave(stageNames, stageMap, repoCreationPath, (refName) => Promise.resolve());
    }

    describe(`Save & Restore References - ${testingStorageType}`, function () {

        const storePath = path.join(perSuiteResourcePath, 'repo-store');
        const refStoreName = 'references';

        before('Save references', function() {
            let refMaker = vcs.RepoReferenceMaker.create(
                repoCreationPath,
                storePath,
                refStoreName,
                testingStorageType
            );

            return Promise.resolve()
            .then(() => {
                return fs.emptyDir(perSuiteResourcePath)
                .then(() => {
                    return fs.emptyDir(repoCreationPath);
                })
                .then(() => {
                    fs.emptyDir(storePath);
                });
            })
            .then(() => {
                return buildRepoAndSave(
                    repoCreationConfig.stageNames,
                    repoCreationConfig.stageMap,
                    repoCreationPath,
                    (refName) => {
                        return refMaker.save(refName)
                        .then(() => {
                            return fs.copy(
                                repoCreationPath,
                                path.join(repoReplacementPath, refName)
                            );
                        });
                    }
                );
            });
        });

        after('Clean up', function() {
            return fs.remove(perSuiteResourcePath);
        });

        let injectReplacementOrder = utils.shuffle(repoCreationConfig.stageNames);
        let restoreOrder = utils.shuffle(repoCreationConfig.stageNames);

        restoreOrder.forEach((restoredName, testIndex) => {

            let refManager;

            describe('Replayed And Restored Should Equal', function() {
                before('Initialization', function() {
                    return vcs.RepoReferenceManager.create(
                        testUnitRepoRestorePath,
                        storePath,
                        refStoreName
                    )
                    .then(result => {
                        refManager = result;
                    });
                });

                describe(`${restoredName}`, function() {

                    before('Replay', function() {
                        return fs.emptyDir(testUnitWorkingPath)
                        .then(() => {
                            return fs.emptyDir(testUnitRepoReplayPath);
                        })
                        .then(() => {
                            return buildRepoUpTo(
                                repoCreationConfig.stageNames,
                                repoCreationConfig.stageMap,
                                restoredName,
                                testUnitRepoReplayPath
                            );
                        });
                    });

                    beforeEach('Clear restored path', function() {
                        return fs.remove(testUnitRepoRestorePath);
                    });
    
                    after('Clean up', function() {
                        return fs.remove(testUnitWorkingPath);
                    });
    
                    it('Restore to empty', function() {
                        return refManager.restore(restoredName)
                        .then(() => {
                            return utils.areDirectorySame(
                                testUnitRepoReplayPath,
                                testUnitRepoRestorePath,
                            );
                        })
                        .should.eventually.equal(true);
                    });

                    it('Restore to dirty', function() {
                        let injectedName = injectReplacementOrder[testIndex];

                        return fs.copy(
                            path.join(repoReplacementPath, injectedName),
                            testUnitRepoRestorePath
                        )
                        .then(() => {
                            return refManager.restore(restoredName)
                        })
                        .then(() => {
                            return utils.areDirectorySame(
                                testUnitRepoReplayPath,
                                testUnitRepoRestorePath
                            );
                        })
                        .should.eventually.equal(true);
                    })
                });
            });


        })

    });


}

/**
 * 
 * @param {Array<String>} testdataEntryNames 
 */
function createTests(testdataEntryNames, testingStorageType) {

    describe(`Save & Restore Repo, type: ${testingStorageType}`, function() {

        this.timeout(4000);

        const workingPath =
            path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');

        const originalName = 'original';
        const restoredName = 'restored';

        const originalPath = path.join(workingPath, originalName);
        const restoredPath = path.join(workingPath, restoredName);

        const repoStorePath = path.join(workingPath, 'repoStores');

        before('Initialize playground', function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        })

        before('Load testdata', function() {

            this.enableTimeouts(false);

            return fs.emptyDir(testdataBasePath)
            .then(() => {
                return zip.extractArchiveTo(
                    path.join(utils.ARCHIVE_RESOURCES_PATH, testdataName) + '.zip',
                    testdataBasePath
                );
            })
            .then(() => {
                let decompressions = [];
                testdataEntryNames.forEach(testdataEntryName => {
                    decompressions.push(
                        zip.extractArchiveTo(
                            path.join(testdataPath, testdataEntryName) + '.zip',
                            testdataBasePath
                        )
                    )
                });

                return Promise.all(decompressions);
            });
        });

        beforeEach('Clean up working path', function() {
            return fs.emptyDir(workingPath);
        })

        after('Clean up playground', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        function LoadsRepositoryFromDataset(repoName, loadedName) {
            let loadedPath = path.join(workingPath, loadedName);

            return fs.emptyDir(loadedPath)
            .then(() => {
                return fs.copy(
                    path.join(testdataBasePath, repoName),
                    loadedPath
                );
            });
        }

        function VerifyOriginalAndRestoredEqual(testdataEntryName) {

            return Promise.all([
                fs.exists(originalPath)
                .should.eventually.equal(true, `original missing for ${testdataEntryName}`),
                fs.exists(restoredPath)
                .should.eventually.equal(true, `restored missing for ${testdataEntryName}`)
            ])
            .then(() => {
                return utils.areDirectorySame(
                    originalPath,
                    restoredPath,
                    true
                ).should.eventually.equal(true, `expect equal for ${testdataEntryName}`);
            })
        }

        function SaveAndRestoreEqualOriginal(testdataEntryName, saveAndRestore) {
            return LoadsRepositoryFromDataset(testdataEntryName, originalName)
            .then(() => {
                return saveAndRestore(
                    workingPath,
                    originalName,
                    restoredName
                )
            })
            .then(() => {
                return VerifyOriginalAndRestoredEqual(testdataEntryName);
            })
        }

        function RestoreEqualToOriginal(testdataEntryName, restore) {
            return LoadsRepositoryFromDataset(testdataEntryName, originalName)
            .then(() => {
                return restore(restoredPath, testdataEntryName);
            })
            .then(() => {
                return VerifyOriginalAndRestoredEqual(testdataEntryName);
            });
        }

        function SaveAndRestoreToDirtyFolderEqualOriginal_1(originalName, saveAndRestore) {
            let randomFilePath = 
            path.join(restoredPath, 'fdjsinoivndiowjfidjsfkljioewjfklds');

            return LoadsRepositoryFromDataset(originalName, restoredName)
            .then(() => {
                return fs.writeFile(randomFilePath, 'fjdiovneiniosfiodfjioe')
            })
            .then(() => {
                return SaveAndRestoreEqualOriginal(
                    originalName,
                    saveAndRestore
                );
            })
            .then(() => {
                return fs.exists(randomFilePath)
                .should.eventually.equal(false, 'expect the random dirty file does not exists after restored');
            })
        }

        function SaveAndRestoreToDirtyFolderEqualOriginal_2(targetOriginName, dirtyOriginName, saveAndRestore) {

            return LoadsRepositoryFromDataset(dirtyOriginName, restoredName)
            .then(() => {
                return SaveAndRestoreEqualOriginal(
                    targetOriginName,
                    saveAndRestore
                );
            });
        }

        describe('Save & Restore Reference Repo', function() {

            describe('Save All & Restore Each', function() {

                before('Save All', function() {

                    this.enableTimeouts(false);

                    let shuffuled = testdataEntryNames.slice();

                    utils.shuffle(shuffuled);

                    let saveThread = Promise.resolve();

                    shuffuled.forEach(testdataEntryName => {
                        saveThread = saveThread.then(() => {
                            return vcs.RepoReferenceMaker.create(
                                path.join(testdataBasePath, testdataEntryName),
                                path.join(testdataBasePath, 'stores'),
                                'ref-store',
                                testingStorageType
                            )
                            .then(maker => {
                                return maker.save(testdataEntryName)
                            })
                            
                        });
                    });

                    return saveThread;

                });

                function Restore(restorePath, referenceName) {
                    return vcs.RepoReferenceManager.create(
                        restorePath,
                        path.join(testdataBasePath, 'stores'),
                        'ref-store',
                        testingStorageType
                    )
                    .then(manager => {
                        return manager.restore(referenceName);
                    })
                }

                let shuffuled = testdataEntryNames.slice();

                utils.shuffle(shuffuled);

                shuffuled.forEach(testdataEntryName => {
                    it(`${testdataEntryName}`, function() {
                        return LoadsRepositoryFromDataset(testdataEntryName, originalName)
                        .then(() => {
                            return RestoreEqualToOriginal(
                                testdataEntryName, 
                                Restore
                            );
                        })
                    }) 
                })

                
            })

            describe('Save & Restore Equal Original', function() {

                function SaveAndRestore(workingPath, originalName, restoredName) {

                    let refStoreName = 'backup';
                    return vcs.RepoReferenceMaker.create(
                        path.join(workingPath, originalName),
                        repoStorePath,
                        refStoreName,
                        testingStorageType
                    )
                    .then(refMaker => {
                        return refMaker.save('backup');
                    })
                    .then(() => {
                        return vcs.RepoReferenceManager.create(
                            path.join(workingPath, restoredName),
                            repoStorePath,
                            refStoreName,
                            testingStorageType
                        )
                    })
                    .then(refManager => {
                        return refManager.restore('backup');
                    })
                }

                testdataEntryNames.forEach((testdataEntryName, index) => {
                    it(`${testdataEntryName}`, function() {
                        return SaveAndRestoreEqualOriginal(
                            testdataEntryName,
                            SaveAndRestore
                        )
                    })
                })

                it('dirty path got cleaned up', function() {
                    return SaveAndRestoreToDirtyFolderEqualOriginal_1(
                        testdataEntryNames[0],
                        SaveAndRestore
                    );
                });

                it('restore resets repository', function() {
                    return SaveAndRestoreToDirtyFolderEqualOriginal_2(
                        testdataEntryNames[testdataEntryNames.length - 1],
                        testdataEntryNames[Math.ceil(testdataEntryNames.length / 2)],
                        SaveAndRestore
                    );
                });    
            })

        });

        describe('Save & Restore Repo Checkpoints', function() {

            describe('Save & Restore Equal Original', function() {

                function SaveAndRestore(workingPath, originalName, restoredName) {
                    let storeName = 'backup';
                    let checkpointName = 'backup';
                    return vcs.RepoCheckpointManager.create(
                        path.join(workingPath, originalName),
                        repoStorePath,
                        storeName,
                        testingStorageType
                    )
                    .then(checkPointManager => {
                        return checkPointManager.backup(checkpointName);
                    })
                    .then(() => {
                        return vcs.RepoCheckpointManager.create(
                            path.join(workingPath, restoredName),
                            repoStorePath,
                            storeName,
                            testingStorageType
                        )
                    })
                    .then(checkPointManager => {
                        return checkPointManager.restore(checkpointName);
                    })
                }

                testdataEntryNames.forEach(testdataEntryName => {
                    it(`${testdataEntryName}`, function() {
                        return SaveAndRestoreEqualOriginal(
                            testdataEntryName,
                            SaveAndRestore
                        );
                    })
                });

                it('dirty path got cleaned up', function() {
                    return SaveAndRestoreToDirtyFolderEqualOriginal_1(
                        testdataEntryNames[testdataEntryNames.length - 1],
                        SaveAndRestore
                    );
                });

                it('restore resets repository', function() {
                    return SaveAndRestoreToDirtyFolderEqualOriginal_2(
                        testdataEntryNames[Math.ceil(testdataEntryNames.length / 3)],
                        testdataEntryNames[Math.ceil(testdataEntryNames.length * 2 / 3)],
                        SaveAndRestore
                    );
                });                
            })
        });
        
    });
}