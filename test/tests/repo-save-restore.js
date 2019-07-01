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

        const workingPath =
            path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');

        const originalName = 'original';
        const restoredName = 'restored';

        const originalPath = path.join(workingPath, originalName);
        const restoredPath = path.join(workingPath, restoredName);

        const repoStorePath = path.join(utils.PLAYGROUND_PATH, 'repoStores');

        before('Initialize playground', function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        })

        before('Load testdata', function() {
            return fs.emptyDir(testdataBasePath)
            .then(() => {
                return zip.extractArchiveTo(
                    path.join(utils.ARCHIVE_RESOURCES_PATH, testdataName) + '.zip',
                    testdataBasePath
                );
            });
        });

        beforeEach('Clean up working path', function() {
            return fs.emptyDir(workingPath);
        })

        after('Clean up playground', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        function LoadsRepositoryFromDataset(repoName, loadedName) {
            return zip.extractArchiveTo(
                path.join(testdataPath, repoName) + '.zip',
                workingPath
            )
            .then(() => {
                return fs.move(
                    path.join(workingPath, repoName),
                    path.join(workingPath, loadedName)
                )
            });
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
                return Promise.all([
                    fs.exists(originalPath)
                    .should.eventually.equal(true, `original missing for ${testdataEntryName}`),
                    fs.exists(restoredPath)
                    .should.eventually.equal(true, `restored missing for ${testdataEntryName}`)
                ])
            })
            .then(() => {
                return utils.areDirectorySame(
                    originalPath,
                    restoredPath
                ).should.eventually.equal(true, `expect equal for ${testdataEntryName}`);
            })
        }
            
        describe('Save & Restore Reference Repo', function() {

            describe('Save & Restore Equal Original', function() {

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
                        return fs.emptyDir(path.join(workingPath, restoredName))
                        .then(() => {
                            return vcs.RepoReferenceManager.create(
                                path.join(workingPath, restoredName),
                                repoStorePath,
                                refStoreName
                            )
                        });
                    })
                    .then(refManager => {
                        return refManager.restore('backup');
                    })
                }

                testdataEntryNames.forEach(testdataEntryName, () => {
                    it(`${testdataEntryName}`, function() {
                        return SaveAndRestoreEqualOriginal(
                            testdataName,
                            SaveAndRestore
                        )
                    })
                })
            })

        });

        describe('Save & Restore Repo Checkpoints', function() {

        });
        
    });
}