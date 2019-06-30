'use strict';

const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const simpleGit = require('simple-git/promise');
const utils = require('./test-utils');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const zip = require('../../lib/simple-archive');

chai.use(chaiAsPromised);
chai.should();

describe.only("Test Utils", function() {
    describe("Folder Equality", function() {

        const testdataName = 'compare-vcs-version-archives';
        const testdataBasePath =
            path.join(utils.PLAYGROUND_PATH, 'testdata');
        const testdataPath =
            path.join(testdataBasePath, testdataName);

        let wait = (resolve, shouldWait) => {
            if (shouldWait()) {
                setTimeout(() => wait(resolve), 10);
            }
            else {
                resolve();
            }
        }

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
    });
});

function createTests(testdataEntryNames) {

    describe("Test Utils", function() {
        describe("Folder Equality", function() {

            const testdataName = 'compare-vcs-version-archives';
            const testdataBasePath =
                path.join(utils.PLAYGROUND_PATH, 'testdata');
            const testdataPath =
                path.join(testdataBasePath, testdataName);
    
            const workingPath =
                path.join(utils.PLAYGROUND_PATH, 'test-folder-equality');
    
            const firstOperandName = 'first';
            const secondOperandName = 'second';

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