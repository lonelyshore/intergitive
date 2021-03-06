'use strict';

const path = require('path');
const fs = require('fs-extra');
const utils = require('./test-utils');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const zip = require('../../src/main/simple-archive');

chai.use(chaiAsPromised);
chai.should();

const testdataPath =
    path.join(utils.PLAYGROUND_PATH, 'testdata');

function loadTestdata(testdataArchivesNames, testdataPath) {
    return fs.emptyDir(testdataPath)
    .then(() => {
        let loadThread = Promise.resolve();
        testdataArchivesNames.forEach(testdataArchiveName => {
            loadThread = loadThread.then(() => {
                return zip.extractArchiveTo(
                    path.join(
                        utils.ARCHIVE_RESOURCES_PATH,
                        testdataArchiveName
                    ) + '.zip',
                    testdataPath
                );
            });
        });

        return loadThread;
    });
}

describe.skip('Prepare test-utils tests', function() {

    after('Clean up playground', function() {
        return fs.remove(utils.PLAYGROUND_PATH);
    });

    it('GENERATE LOCAL TESTS', function() {

        const localTestdataArchiveNames = [
            'local-repo-edgecases',
            'compare-vcs-local-ref-snapshot'
        ];

        return GenerateCompareTestsForArchives(
            localTestdataArchiveNames,
            'local'
        );
    });

    it('GENERATE REMOTE TESTS', function() {

        const remoteTestdataArchiveNames = [
            'compare-vcs-remote-ref-snapshot'
        ];

        return GenerateCompareTestsForArchives(
            remoteTestdataArchiveNames,
            'remote'
        );
    });   

    function GenerateCompareTestsForArchives(archiveNames, experimentName) {
        let testdataEntryNames = [];

        return fs.emptyDir(utils.PLAYGROUND_PATH)
        .then(() => {
            return fs.emptyDir(testdataPath)
        })
        .then(() => {
            return loadTestdata(archiveNames, testdataPath);
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
            createTests(archiveNames, testdataEntryNames, experimentName);
        });
    }
});


function createTests(testdataArchiveNames, testdataEntryNames, experimentName) {

    describe(`Test Utils - ${experimentName}`, function() {
        describe("Folder Equality", function() {
    
            const workingPath =
                path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');
    
            const firstOperandName = 'first';
            const secondOperandName = 'second';

            before('Initialize playground', function() {
                return fs.emptyDir(utils.PLAYGROUND_PATH);
            })
    
            before('Load testdata', function() {
                return loadTestdata(testdataArchiveNames, testdataPath);
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
                    path.join(workingPath, loadedName)
                );
            }
    
            function LoadsFirstAndSecond(firstSourceName, secondSourceName) {
                return LoadsRepositoryFromDataset(firstSourceName, firstOperandName)
                .then(() => {
                    return LoadsRepositoryFromDataset(secondSourceName, secondOperandName);
                });
            }

            describe("Equal", function() {
                testdataEntryNames.forEach(testdataEntryName => {
                    it(`${testdataEntryName}`, function() {
                        return LoadsFirstAndSecond(testdataEntryName, testdataEntryName)
                        .then(() => {
                            return utils.areDirectorySame(
                                path.join(workingPath, firstOperandName),
                                path.join(workingPath, secondOperandName)
                            );
                        })
                        .should.eventually.equal(true, 'Expect duplicated repositories equal to each other');
                    })
                })
    
            });
    
            describe("Different", function() {
    
                for (let i = 0; i < testdataEntryNames.length; i++) {
                    for (let j = i + 1; j < testdataEntryNames.length; j++) {
                        let firstName = testdataEntryNames[i];
                        let secondName = testdataEntryNames[j];
    
                        it(`${firstName} V.S. ${secondName}`, function() {
                            return LoadsFirstAndSecond(
                                firstName,
                                secondName
                            )
                            .then(() => {
                                return utils.areDirectorySame(
                                    path.join(workingPath, firstOperandName),
                                    path.join(workingPath, secondOperandName)
                                )
                            })
                            .should.eventually.equal(false, 'Expect different repositories are not equal');
                        })
                    }
                }
            });
        });
    });    
}