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

const createdRepoName = 'repo';
const repoCreationPath = path.join(utils.PLAYGROUND_PATH, 'created-repo', createdRepoName);
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
        undefined,
        assetLoader,
        repoSetups
    );
}

const repoCreationConfigExecutor = new utils.RepoArchiveConfigExecutor();

const repoCreationConfig = repoCreationConfigExecutor.loadConfigSync(
    repoCreationConfigPath
);

let repoCreationActionExecutor = createRepoCreationActionExecutor(
    repoCreationPath
);

describe('Prepare Repo Save & Restore Tests', function() {

    describe('Replay and capture snapshot', function() {

        before('Initialize', function() {
            return fs.emptyDir(repoCreationPath)
            .then(() => {
                return fs.emptyDir(repoSnapshotsPath);
            });
        });

        after('Clean up', function() {
            return fs.emptyDir(repoCreationPath);
        })

        repoCreationConfig.stageNames.forEach(stageName => {

            it(`Replay ${stageName}`, function() {

                this.timeout(4000);

                let stageSnapshotPath = path.join(repoSnapshotsPath, stageName);
                return repoCreationConfigExecutor.executeStage(stageName, repoCreationConfig.stageMap, repoCreationActionExecutor)
                .then(() => {
                    return fs.copy(
                        repoCreationPath,
                        stageSnapshotPath
                    );
                })
                .then(() => {
                    return utils.areDirectorySame(
                        repoCreationPath,
                        stageSnapshotPath
                    )
                })
                .should.eventually.equal(true, `Expect snapshot of replayed stage ${stageName} should equal`);
            });

        });

    });

    it(`GENERATE LOCAL TESTS`, function() {
        return createTests(repoCreationConfig.stageNames, false, testingStorageTypes);
    });

});

/**
 * 
 * @param {Array<String>} testdataEntryNames 
 */
function createTests(testdataEntryNames, isRemoteRepo, testingStorageTypes) {

    describe('Save & Restore Repo', function() {

        before('Create snapshots', function() {

            this.timeout(72000);

            return fs.emptyDir(repoCreationPath)
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
                                repoCreationPath,
                                stageSnapshotPath
                            );
                        });
                    });
        
                });

                return thread;
            });
        });

        after('Clean up', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

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