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

const repoSnapshotsPath =
    path.join(utils.PLAYGROUND_PATH, 'repo-snapshots');

const testingStorageTypes = [
    vcs.STORAGE_TYPE.ARCHIVE,
    // vcs.STORAGE_TYPE.GIT
];

const repoCreationWorkingPath = path.join(utils.PLAYGROUND_PATH, 'created-repo');


describe('Prepare Repo Save & Restore Tests', function() {

    testSnapshotsMatchReplayAndCreateTests(
        path.join(
            utils.RESOURCES_PATH, 
            "vcs-compare", "generate-base-repo.yaml"
        ),
        'local',
        false
    );

    testSnapshotsMatchReplayAndCreateTests(
        path.join(
            utils.RESOURCES_PATH,
            'vcs-compare', 'generate-remote-repo.yaml'
        ),
        'remote',
        true
    );

    function testSnapshotsMatchReplayAndCreateTests(repoCreationConfigPath, targetRepoName, isRemote) {

        function createRepoCreationActionExecutor(workingPath, creationConfig, configExecutor) {

            let assetLoader = new AssetLoader(
                path.join(utils.RESOURCES_PATH, creationConfig.resourcesSubPath)
            );

            assetLoader.setBundlePath();

            let repoSetups = configExecutor.createRepoVcsSetupsFromConfig(creationConfig);

            let actionExecutor = new ActionExecutor(
                workingPath,
                undefined,
                assetLoader,
                repoSetups
            );

            return actionExecutor;
        }

        const repoCreationConfigExecutor = new utils.RepoArchiveConfigExecutor();

        const repoCreationConfig = repoCreationConfigExecutor.loadConfigSync(
            repoCreationConfigPath
        );

        let repoCreationActionExecutor = createRepoCreationActionExecutor(
            repoCreationWorkingPath,
            repoCreationConfig,
            repoCreationConfigExecutor
        );

        const targetRepoCreationPath = 
            repoCreationActionExecutor
            .getRepoFullPaths(targetRepoName)
            .fullWorkingPath;

        const allRepoCreationPaths = [];
        repoCreationActionExecutor.getRepoSetupNames().forEach(setupName => {
            allRepoCreationPaths.push(
                repoCreationActionExecutor.getRepoFullPaths(setupName)
                .fullWorkingPath
            );
        });

        function clearAllCreationPaths() {
            let clear = Promise.resolve();
            allRepoCreationPaths.forEach(repoCreationPath => {
                clear = clear.then(() => {
                    return fs.emptyDir(repoCreationPath);
                });
            });

            return clear;
        }

        function initializeAllCreationPaths() {
            return repoCreationConfigExecutor.initializeRepos(
                repoCreationWorkingPath,
                utils.ARCHIVE_RESOURCES_PATH,
                repoCreationConfig,
            );
        }

        describe(`Replay and capture snapshot - ${targetRepoName}`, function() {

            before('Initialize', function() {

                return initializeAllCreationPaths()
                .then(() => {
                    return fs.emptyDir(repoSnapshotsPath);
                });
            });

            after('Clean up', function() {
                return clearAllCreationPaths();
            })

            repoCreationConfig.stageNames.forEach(stageName => {

                it(`Replay ${stageName}`, function() {

                    this.timeout(4000);

                    let stageSnapshotPath = path.join(repoSnapshotsPath, stageName);
                    return repoCreationConfigExecutor.executeStage(stageName, repoCreationConfig.stageMap, repoCreationActionExecutor)
                    .then(() => {
                        return fs.copy(
                            targetRepoCreationPath,
                            stageSnapshotPath
                        );
                    })
                    .then(() => {
                        return utils.areDirectorySame(
                            targetRepoCreationPath,
                            stageSnapshotPath
                        )
                    })
                    .should.eventually.equal(true, `Expect snapshot of replayed stage ${stageName} should equal`);
                });

            });

        });

        function createSnapshots() {
            return initializeAllCreationPaths()
            .then(() => {
                return fs.emptyDir(repoSnapshotsPath);
            })
            .then(() => {

                let thread = Promise.resolve();

                repoCreationConfig.stageNames.forEach(stageName => {
        
                    let stageSnapshotPath = path.join(repoSnapshotsPath, stageName);

                    thread = thread.then(() => {
                        return repoCreationConfigExecutor.executeStage(stageName, repoCreationConfig.stageMap, repoCreationActionExecutor)
                        .then(() => {
                            return fs.copy(
                                targetRepoCreationPath,
                                stageSnapshotPath
                            );
                        });
                    });
        
                });

                return thread;
            })
            .then(() => {
                return repoSnapshotsPath;
            });
        }

        it(`GENERATE TESTS ${targetRepoName}`, function() {
            return createTests(
                repoCreationConfig.stageNames, 
                isRemote, 
                testingStorageTypes,
                createSnapshots);
        });
    }
});

/**
 * 
 * @param {Array<String>} testdataEntryNames 
 */
function createTests(testdataEntryNames, isRemoteRepo, testingStorageTypes, createSnapshots) {

    describe('Save & Restore Repo', function() {

        let repoSnapshotsPath;

        before('Create snapshots', function() {

            this.timeout(72000);

            return createSnapshots()
            .then(snapshotPath => {
                repoSnapshotsPath = snapshotPath;
            });

            let clearUp = Promise.resolve();
            repoCreationPaths.forEach(repoCreationPath => {
                clearUp = clearUp.then(() => {
                    return fs.emptyDir(repoCreationPath);
                });
            });


        });

        after('Clean up', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        testingStorageTypes.forEach(testingStorageType => {

            describe(`Save & Restore Repo, type: ${vcs.STORAGE_TYPE.toString(testingStorageType)}`, function () {

                this.timeout(4000);

                const workingPath =
                    path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');

                const originalName = 'original';
                const restoredName = 'restored';

                const originalPath = path.join(workingPath, originalName);
                const restoredPath = path.join(workingPath, restoredName);


                beforeEach('Clean up working path', function () {
                    return fs.emptyDir(workingPath);
                });

                function loadsRepositoryFromSnapshot(repoName, loadedPath) {
                    return fs.emptyDir(loadedPath)
                        .then(() => {
                            return fs.copy(
                                path.join(repoSnapshotsPath, repoName),
                                loadedPath
                            );
                        });
                }

                function verifyOriginalAndRestoredEqual(testdataEntryName) {

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

                /**
                 * @callback SaveAndRestoreSnapshot
                 * @param {String} sourcePath
                 * @param {String} restoredPath
                 * @returns {Promise<Any>}
                 */

                /**
                 * 
                 * @param {String} testdataEntryName 
                 * @param {SaveAndRestoreSnapshot} saveAndRestore 
                 */
                function saveAndRestoreEqualOriginal(testdataEntryName, saveAndRestore) {
                    return loadsRepositoryFromSnapshot(testdataEntryName, originalPath)
                        .then(() => {
                            return saveAndRestore(
                                originalPath,
                                restoredPath
                            )
                        })
                        .then(() => {
                            return verifyOriginalAndRestoredEqual(testdataEntryName);
                        })
                }

                
                /** 
                 * @callback RestoreSnapshot
                 * @param {String} restoredPath
                 * @param {String} restoredSnapshotName
                 * @returns {Promise<Any>}
                */

                /**
                 * 
                 * @param {String} testsedEntryName 
                 * @param {RestoreSnapshot} restore 
                 */
                function restoreEqualToOriginal(testsedEntryName, restore) {
                    return loadsRepositoryFromSnapshot(testsedEntryName, originalPath)
                        .then(() => {
                            return restore(restoredPath, testsedEntryName);
                        })
                        .then(() => {
                            return verifyOriginalAndRestoredEqual(testsedEntryName);
                        });
                }

                /**
                 * 
                 * @callback PreSaveSnapshot
                 * @param {string} sourcePath
                 * @param {string} snapshotName
                 * @returns {Promise<Any>}
                 */
                
                /**
                 * 
                 * @param {PreSaveSnapshot} preSaveSnapshot 
                 */
                function preSaveAllReplays(preSaveSnapshot) {
                    
                    let savingOrder =
                        utils.inplaceShuffle(testdataEntryNames.slice());

                    let saveThread = Promise.resolve();

                    savingOrder.forEach(testdataEntryName => {

                        saveThread = saveThread.then(() => {

                            return preSaveSnapshot(
                                path.join(repoSnapshotsPath, testdataEntryName),
                                testdataEntryName
                            );

                        });

                    });

                    return saveThread;

                }

                const perSuiteResourcePath = path.join(utils.PLAYGROUND_PATH, 'test-suite-scoped-resources');

                function testForSaveAllAndRestoreEach(preSaveSnapshot, restoreSnapshot) {

                    describe('Save All & Restore Each', function () {

                        before('Initialize', function() {
                            return fs.emptyDir(perSuiteResourcePath);
                        });

                        before('Save all replays', function () {

                            this.enableTimeouts(false);

                            return preSaveAllReplays(preSaveSnapshot);
                        });

                        describe('Restore to empty directory', function() {

                            let restoreOrder = utils.inplaceShuffle(
                                testdataEntryNames.slice(0)
                            );

                            restoreOrder.forEach(restoredName => {

                                it(`${restoredName}`, function () {

                                    return restoreEqualToOriginal(
                                        restoredName,
                                        restoreSnapshot
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

                                    return loadsRepositoryFromSnapshot(
                                        injectionOrder[restoredIndex],
                                        restoredPath
                                    )
                                    .then(() => {
                                        return restoreEqualToOriginal(
                                            restoredName,
                                            restoreSnapshot
                                        );
                                    });
                                });

                            });
                                
                        });

                    });
                }

                /**
                 * 
                 * @param {SaveAndRestoreSnapshot} saveAndRestoreSnapshot 
                 */
                function testForSaveAndRestoreSeparatedly(saveAndRestoreSnapshot) {

                    describe('Save & Restore Separatedly', function () {

                        before('Initialize', function() {
                            return fs.emptyDir(perSuiteResourcePath);
                        });

                        testdataEntryNames.forEach(testdataEntryName => {
                            it(`${testdataEntryName}`, function () {
                                return saveAndRestoreEqualOriginal(
                                    testdataEntryName,
                                    saveAndRestoreSnapshot
                                )
                            })
                        });

                    });

                }

                describe('Repository Reference Manager', function () {

                    const storePath =
                        path.join(perSuiteResourcePath, 'repo-store');
                    const refStoreName = 'references';

                    function saveSnapshot(sourcePath, snapshotName) {
                        return vcs.RepoReferenceMaker.create(
                            sourcePath,
                            storePath,
                            refStoreName,
                            isRemoteRepo,
                            testingStorageType
                        )
                        .then(maker => {
                            return maker.save(snapshotName)
                        });
                    }

                    function restoreSnapshot(restoredPath, snapshotName) {
                        return vcs.RepoReferenceManager.create(
                            restoredPath,
                            storePath,
                            refStoreName,
                            isRemoteRepo,
                            testingStorageType
                        )
                        .then(manager => {
                            return manager.restore(snapshotName);
                        });
                    }

                    function saveAndRestore(originalPath, restoredPath) {

                        let bridgingSnapshotName = 'backup-ref';
                        return saveSnapshot(originalPath, bridgingSnapshotName)
                        .then(() => {
                            return restoreSnapshot(restoredPath, bridgingSnapshotName);
                        });

                    }

                    testForSaveAllAndRestoreEach(
                        saveSnapshot,
                        restoreSnapshot
                    );

                    testForSaveAndRestoreSeparatedly(saveAndRestore);

                });

                describe('Save & Restore Repo Checkpoints', function () {

                    const storePath = path.join(perSuiteResourcePath, 'repo-store');
                    const checkpointStoreName = 'checkpoints';

                    function saveSnapshot(sourcePath, snapshotName) {
                        return vcs.RepoCheckpointManager.create(
                            sourcePath,
                            storePath,
                            checkpointStoreName,
                            isRemoteRepo,
                            testingStorageType
                        )
                        .then(manager => {
                            return manager.backup(snapshotName);
                        });
                    }

                    function restoreSnapshot(restoredPath, snapshotName) {
                        return vcs.RepoCheckpointManager.create(
                            restoredPath,
                            storePath,
                            checkpointStoreName,
                            isRemoteRepo,
                            testingStorageType
                        )
                        .then(checkPointManager => {
                            return checkPointManager.restore(snapshotName);
                        });
                    }

                    function saveAndRestore(originalPath, restoredPath) {
                        let bridgingSnapshotName = 'backup';

                        return saveSnapshot(originalPath, bridgingSnapshotName)
                        .then(() => {
                            return restoreSnapshot(restoredPath, bridgingSnapshotName);
                        });
                    }

                    testForSaveAllAndRestoreEach(saveSnapshot, restoreSnapshot);

                    testForSaveAndRestoreSeparatedly(saveAndRestore);
                    
                });

            });
            
        });
    })

}