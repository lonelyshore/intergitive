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

const testdataBasePath =
    path.join(utils.PLAYGROUND_PATH, 'testdata');
const repoSnapshotsPath =
    path.join(utils.PLAYGROUND_PATH, 'repo-snapshots');
const testingStorageTypes = [
    vcs.STORAGE_TYPE.ARCHIVE,
    // vcs.STORAGE_TYPE.GIT
];

describe.only('Prepare Repo Save & Restore Tests', function() {

    const createdRepoName = 'repo';
    const repoCreationPath = path.join(perSuiteResourcePath, 'created-repo', createdRepoName);
    const repoCreationConfigPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-base-repo.yaml");

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

    describe('Replay and capture snapshot', function() {

        before('Initialize', function() {
            return fs.emptyDir(repoCreationPath)
            .then(() => {
                return fs.emptyDir(repoSnapshotsPath);
            })
        });

        let repoCreationActionExecutor = createRepoCreationActionExecutor(
            repoCreationPath
        );

        repoCreationConfig.stageNames.forEach(stageName => {

            it(`Replay ${stageName}`, function() {

                this.timeout(4000);

                let stageSnapshotPath = path.join(repoSnapshotsPath, stageName);
                return repoCreationConfigExecutor.executeStage(stageName, repoCreationConfig.stageMap, repoCreationActionExecutor)
                .then(() => {
                    return fs.copy(
                        createdRepoPath,
                        stageSnapshotPath
                    );
                })
                .then(() => {
                    return utils.areDirectorySame(
                        createdRepoPath,
                        stageSnapshotPath
                    )
                })
                .should.eventually.equal(true, `Expect snapshot of replayed stage ${stageName} should equal`);
            });

        });

    });

    it(`GENERATE TESTS ${testingStorageType}`, function() {
        return createTests(repoCreationConfig.stageNames, testingStorageTypes);
    });

});

function createNewTests(testingStorageType) {

    const perSuiteResourcePath = path.join(utils.PLAYGROUND_PATH, 'test-save-and-restore-relate-resources');

    const repoReplacementPath = path.join(perSuiteResourcePath, 'repo-replacement');
    
    
    const testUnitWorkingPath = path.join(utils.PLAYGROUND_PATH, 'working-path');
    const testUnitRepoReplayPath = path.join(testUnitWorkingPath, 'repo-replay', createdRepoName);
    const testUnitRepoRestorePath = path.join(testUnitWorkingPath, 'restored');


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

        return buildRepoAndSave(subStageNames, stageMap, repoCreationPath, (refName) => Promise.resolve());
    }

    describe(`Save & Restore References - ${testingStorageType}`, function () {

        before('Save references', function() {

            this.enableTimeouts(false);

            let refMaker;

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
                return vcs.RepoReferenceMaker.create(
                    repoCreationPath,
                    storePath,
                    refStoreName,
                    testingStorageType
                )
                .then(result => {
                    refMaker = result;
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

        let injectReplacementOrder = utils.inplaceShuffle(repoCreationConfig.stageNames.slice(0));
        let restoreOrder = utils.inplaceShuffle(repoCreationConfig.stageNames.slice(0));



        describe('Replayed And Restored Should Equal', function() {
            let refManager;

            before('Initialization', function() {
                return vcs.RepoReferenceManager.create(
                    testUnitRepoRestorePath,
                    storePath,
                    refStoreName,
                    testingStorageType
                )
                .then(result => {
                    refManager = result;
                });
            });

            restoreOrder.forEach((restoredName, testIndex) => {

                if (testIndex !== 0) {
                    return;
                }

                describe(`${restoredName}`, function() {

                    before('Replay', function() {

                        this.enableTimeouts(false);

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
                                true
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
                                testUnitRepoRestorePath,
                                true
                            );
                        })
                        .should.eventually.equal(true);
                    })
                });

            });

        });

    });


}

/**
 * 
 * @param {Array<String>} testdataEntryNames 
 */
function createTests(testdataEntryNames, testingStorageTypes) {

    describe('Save & Restore Repo', function() {

        after('Clean up', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        })

        testingStorageTypes.forEach(testingStorageType => {

            describe(`Save & Restore Repo, type: ${testingStorageType}`, function () {

                this.timeout(4000);

                const workingPath =
                    path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');

                const originalName = 'original';
                const restoredName = 'restored';

                const originalPath = path.join(workingPath, originalName);
                const restoredPath = path.join(workingPath, restoredName);


                beforeEach('Clean up working path', function () {
                    return fs.emptyDir(workingPath);
                })

                after('Clean up playground', function () {
                    return fs.remove(utils.PLAYGROUND_PATH);
                });

                function LoadsRepositoryFromSnapshot(repoName, loadedPath) {
                    return fs.emptyDir(loadedPath)
                        .then(() => {
                            return fs.copy(
                                path.join(repoSnapshotsPath, repoName),
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
                    return LoadsRepositoryFromSnapshot(testdataEntryName, originalPath)
                        .then(() => {
                            return saveAndRestore(
                                originalPath,
                                restoredPath
                            )
                        })
                        .then(() => {
                            return VerifyOriginalAndRestoredEqual(testdataEntryName);
                        })
                }

                function RestoreEqualToOriginal(testsedEntryName, restore) {
                    return LoadsRepositoryFromSnapshot(testsedEntryName, originalPath)
                        .then(() => {
                            return restore(restoredPath, testsedEntryName);
                        })
                        .then(() => {
                            return VerifyOriginalAndRestoredEqual(testsedEntryName);
                        });
                }

                const perSuiteResourcePath = path.join(utils.PLAYGROUND_PATH, 'test-suite-scoped-resources');

                describe('Repository Reference Manager', function () {

                    const storePath =
                        path.join(perSuiteResourcePath, 'repo-store');
                    const refStoreName = 'references';

                    describe('Save All & Restore Each', function () {

                        before('Initialize', function() {
                            return fs.emptyDir(perSuiteResourcePath);
                        })

                        before('Save all replays', function () {

                            this.enableTimeouts(false);

                            let savingOrder =
                                utils.inplaceShuffle(testdataEntryNames.slice());

                            let saveThread = Promise.resolve();

                            savingOrder.forEach(testdataEntryName => {

                                saveThread = saveThread.then(() => {

                                    return vcs.RepoReferenceMaker.create(
                                        path.join(repoSnapshotsPath, testdataEntryName),
                                        storePath,
                                        refStoreName,
                                        testingStorageType
                                    )
                                    .then(maker => {
                                        return maker.save(testdataEntryName)
                                    })

                                });

                            });

                            return saveThread;

                        });

                        function restoreFunction(restoredPath, referenceName) {
                            return vcs.RepoReferenceManager.create(
                                restoredPath,
                                storePath,
                                refStoreName,
                                testingStorageType
                            )
                            .then(manager => {
                                return manager.restore(referenceName);
                            })
                        }

                        describe('Restore to empty directory', function() {
                            let restoreOrder = utils.inplaceShuffle(
                                testdataEntryNames.slice(0)
                            );

                            restoreOrder.forEach(restoredName => {

                                it(`${restoredName}`, function () {

                                    return RestoreEqualToOriginal(
                                        restoredName,
                                        restoreFunction
                                    );

                                });

                            });
                        });

                        describe('Restore to dirty directory', function() {
                            let restoreOrder = utils.inplaceShuffle(
                                testdataEntryNames.slice(0)
                            );

                            let injectionOrder = utils.inplaceShuffle(
                                testdataEntryNames.slice(0)
                            );

                            restoreOrder.forEach((restoredName, restoredIndex) => {
                                
                                it(`${restoredName}`, function() {

                                    return LoadsRepositoryFromSnapshot(
                                        injectionOrder[restoredIndex],
                                        restoredPath
                                    )
                                    .then(() => {
                                        return RestoreEqualToOriginal(
                                            restoredName,
                                            restoreFunction
                                        );
                                    });
                                });

                            });
                                
                        });

                    });

                    describe('Save & Restore Separatedly', function () {

                        function SaveAndRestore(originalPath, restoredPath) {

                            let refStoreName = 'backup';
                            let refName = 'backup-ref';
                            return vcs.RepoReferenceMaker.create(
                                originalPath,
                                storePath,
                                refStoreName,
                                testingStorageType
                            )
                            .then(refMaker => {
                                return refMaker.save(refName);
                            })
                            .then(() => {
                                return vcs.RepoReferenceManager.create(
                                    restoredPath,
                                    storePath,
                                    refStoreName,
                                    testingStorageType
                                )
                            })
                            .then(refManager => {
                                return refManager.restore(refName);
                            });

                        }

                        testdataEntryNames.forEach(testdataEntryName => {
                            it(`${testdataEntryName}`, function () {
                                return SaveAndRestoreEqualOriginal(
                                    testdataEntryName,
                                    SaveAndRestore
                                )
                            })
                        })
                    })

                });

                describe('Save & Restore Repo Checkpoints', function () {

                    describe('Save & Restore Equal Original', function () {

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
                            it(`${testdataEntryName}`, function () {
                                return SaveAndRestoreEqualOriginal(
                                    testdataEntryName,
                                    SaveAndRestore
                                );
                            })
                        });

                    })
                });

            });
            
        });
    })

}