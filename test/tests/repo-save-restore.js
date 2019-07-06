"use strict";

const path = require("path");
const fs = require("fs-extra");
const utils = require("./test-utils");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const zip = require("../../lib/simple-archive");
const vcs = require("../../lib/repo-vcs");

chai.use(chaiAsPromised);
chai.should();

const testdataName = 'compare-vcs-version-archives';
const testdataBasePath =
    path.join(utils.PLAYGROUND_PATH, 'testdata');
const testdataPath =
    path.join(testdataBasePath, testdataName);

describe.only('Prepare Repo Save & Restore Tests', function() {

    after('Clean up playground', function() {
        return fs.remove(utils.PLAYGROUND_PATH);
    });

    it('GENERATE TESTS', function() {

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
            createTests(testdataEntryNames);
        });
    });

})

/**
 * 
 * @param {Array<String>} testdataEntryNames 
 */
function createTests(testdataEntryNames) {

    describe('Save & Restore Repo', function() {

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
                                'ref-store'
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
                        'ref-store'
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

            describe.skip('Save & Restore Equal Original', function() {

                function SaveAndRestore(workingPath, originalName, restoredName) {

                    let refStoreName = 'backup';
                    return vcs.RepoReferenceMaker.create(
                        path.join(workingPath, originalName),
                        repoStorePath,
                        refStoreName
                    )
                    .then(refMaker => {
                        return refMaker.save('backup');
                    })
                    .then(() => {
                        return vcs.RepoReferenceManager.create(
                            path.join(workingPath, restoredName),
                            repoStorePath,
                            refStoreName
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

        describe.skip('Save & Restore Repo Checkpoints', function() {

            describe('Save & Restore Equal Original', function() {

                function SaveAndRestore(workingPath, originalName, restoredName) {
                    let storeName = 'backup';
                    let checkpointName = 'backup';
                    return vcs.RepoCheckpointManager.create(
                        path.join(workingPath, originalName),
                        repoStorePath,
                        storeName
                    )
                    .then(checkPointManager => {
                        return checkPointManager.backup(checkpointName);
                    })
                    .then(() => {
                        return vcs.RepoCheckpointManager.create(
                            path.join(workingPath, restoredName),
                            repoStorePath,
                            storeName
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