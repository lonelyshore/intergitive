'use strict';

const path = require('path');
const fs = require('fs-extra');
const eol = require('../../lib/text-eol');
const zip = require('../../lib/simple-archive');
const simpleGitCtor = require('simple-git/promise');
const utils = require('./test-utils');
const AssetLoader = require('../../lib/asset-loader').AssetLoader;
const ActionExecutor = require('../../lib/action-executor').ActionExecutor;
const RepoVcsSetup = require('../../lib/config-level').RepoVcsSetup;
const RepoReferenceManager = require('../../lib/repo-vcs').RepoReferenceManager;
const actionTypes = require('../../lib/config-action');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();


describe('Action Executor #core', function() {

    let actionExecutor;
    const testRepoSetupName = 'test-repo';
    const repoParentPath = path.join(utils.PLAYGROUND_PATH, 'repo');
    const repoArchiveName = 'action-executor';
    const workingPath = path.join(repoParentPath, repoArchiveName);    

    before(function() {
        let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor', 'resources'));
        assetLoader.setBundlePath();

        let repoSetups = {
            [testRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, workingPath),
                '',
                ''
            )
        };

        actionExecutor = new ActionExecutor(utils.PLAYGROUND_PATH, assetLoader, repoSetups);
    })

    describe('File Operations', function() {

        /**
         * 
         * @param {string} str
         * @returns {string} 
         */
        const reverseString = function(str) {
            return str.split('').reverse().join('');
        }

        const initializeFolder = function(fileSubPaths, baseFolderPath) {

            let operations = fileSubPaths.map(fileSubPath => {

                let filePath = path.join(baseFolderPath, fileSubPath);

                let parsed = path.parse(filePath);

                return fs.ensureDir(parsed.dir)
                .then(() => { 
                    return fs.exists(filePath);
                })
                .then(exists => {
                    let next = Promise.resolve();
                    if (exists) {
                        next = next.then(() => {
                            return fs.remove(filePath);
                        });
                    }
                    
                    next = next.then(() => {
                        return fs.writeFile(filePath, reverseString(parsed.name));
                    });

                    return next;
                });
            });

            return Promise.all(operations);
        };

        beforeEach('Initialize Playground', function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        });

        afterEach('Remove Playground', function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        describe('Write File', function() {

            const appendFolderName = function(fileSubPaths, folderName) {
                let ret = [];
                fileSubPaths.forEach(fileSubPath => {
                    ret.push(folderName + '/' + path.basename(fileSubPath));
                });

                return ret;
            }

            /**
             * 
             * @param {string} filePath 
             * @param {string} content 
             */
            const fileHasContent = function(baseFolder, fileSubPath, content) {
                let filePath = path.join(baseFolder, fileSubPath);

                return fs.exists(filePath)
                .then(exists => {
                    if (!exists) {
                        return false;
                    }
                    else {
                        return fs.readFile(path.join(baseFolder, fileSubPath), 'utf8')
                        .then(fileContent => {
                            return fileContent === content;
                        });
                    }
                });
            };

            /**
             * 
             * @param {string} baseFolder 
             * @param {Array<string>} fileSubPaths 
             * @param {Array<string>} contents 
             * @returns {Promise<Boolean>}
             */
            const allFilesHasContents = function(baseFolder, fileSubPaths, contents) {
                let checks = [];
                fileSubPaths.forEach((subPath, index) => {
                    checks.push(
                        fileHasContent(baseFolder, subPath, contents[index])
                    );
                });

                return Promise.all(checks).then(results => {
                    return results.every(result => result);
                });
            }

            it('files not overwritting', function() {
                
                let targets = ['manyFiles1', 'manyFiles2']
                let keys = appendFolderName(targets, 'write-file');
                
                let action = new actionTypes.WriteFileAction(
                    keys,
                    targets
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return allFilesHasContents(
                        utils.PLAYGROUND_PATH,
                        targets,
                        targets
                    );
                })
                .should.eventually.equal(true);
            });

            it('files overwritting', function() {

                let targets = ['manyFilesOverwritting1', 'manyFilesOverwritting2'];
                let keys = appendFolderName(targets, 'write-file');

                let action = new actionTypes.WriteFileAction(
                    keys,
                    targets
                );

                return initializeFolder(targets, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return allFilesHasContents(
                        utils.PLAYGROUND_PATH,
                        targets,
                        targets
                    );
                })
                .should.eventually.equal(true);

            });

            it('files inside path not overwritting', function() {
                
                let targets = ['manyFilesInPath1', 'manyFilesInPath2'];
                let keys = appendFolderName(targets, 'write-file');
                let destinations = appendFolderName(targets, 'parent');

                let action = new actionTypes.WriteFileAction(
                    keys,
                    destinations
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return allFilesHasContents(
                        utils.PLAYGROUND_PATH,
                        destinations,
                        targets
                    );
                })
                .should.eventually.equal(true);

            });

            it('files inside path overwritting', function() {
                
                let targets = ['manyFilesInPathOverwritting1', 'manyFilesInPathOverwritting2'];
                let keys = appendFolderName(targets, 'write-file');
                let destinations = appendFolderName(targets, 'parent');

                let action = new actionTypes.WriteFileAction(
                    keys,
                    destinations
                );

                return initializeFolder(destinations, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return allFilesHasContents(
                        utils.PLAYGROUND_PATH,
                        destinations,
                        targets
                    );
                })
                .should.eventually.equal(true);

            });

            it('unrelated files intact', function() {
                
                let targets = ['manyFiles1', 'manyFiles2'];
                let keys = appendFolderName(targets, 'write-file');
                let untouched = ['untouched1', 'untouched2'];

                let action = new actionTypes.WriteFileAction(
                    keys,
                    targets
                );

                return initializeFolder(targets.concat(untouched), utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return Promise.all([
                            allFilesHasContents(
                                utils.PLAYGROUND_PATH,
                                targets,
                                targets
                            ),
                            allFilesHasContents(
                                utils.PLAYGROUND_PATH,
                                untouched,
                                untouched.map(c => reverseString(c))
                            )
                        ]);
                })
                .should.eventually.deep.equal([true, true]);
            })

            it('source not exist should fail', function() {
                
                let targets = ['not-exists'];
                let keys = appendFolderName(targets, 'write-file');

                let action = new actionTypes.WriteFileAction(
                    keys,
                    targets
                );
                
                return initializeFolder(targets, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .should.eventually.be.rejected;
                
            });

            it('source not exist destination untouched', function() {
                
                let targets = ['not-exists'];
                let keys = appendFolderName(targets, 'write-file');

                let action = new actionTypes.WriteFileAction(
                    keys,
                    targets
                );
                
                return initializeFolder(targets, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .catch(() => {
                    return allFilesHasContents(
                        utils.PLAYGROUND_PATH,
                        targets,
                        targets.map(c => reverseString(c))
                    );
                })
                .should.eventually.equal(true);
                
            });
        });

        describe('Remove File', function() {

            it('remove single', function() {
                
                let files = [
                    'removed',
                    'untouched'
                ];

                let action = new actionTypes.RemoveFileAction(['removed']);

                return initializeFolder(files, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return Promise.all([
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'removed'))
                        .should.eventually.be.false,
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                        .should.eventually.be.true
                    ]);
                });
            });

            it('remove multiple', function() {
                
                let files = [
                    'removed',
                    'folder/removed',
                    'untouched',
                    'folder/untouched',
                ];

                let action = new actionTypes.RemoveFileAction(['removed', 'folder/removed']);

                return initializeFolder(files, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return Promise.all([
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'removed'))
                        .should.eventually.equal(false, '<removed> still exists'),
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'folder/removed'))
                        .should.eventually.equal(false, '<folderremoved> still exists'),
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                        .should.eventually.equal(true, '<untouched> got removed'),
                        fs.exists(path.join(utils.PLAYGROUND_PATH, 'folder/untouched'))
                        .should.eventually.equal(true, '<folder/untouched> got removed'),
                    ])
                })
            });

            it('any target not exist should fail', function() {
                
                let existsFiles = [
                    'removed',
                    'untouched'
                ];

                let action = new actionTypes.RemoveFileAction(
                    ['removed', 'notExists']
                );

                return initializeFolder(existsFiles, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .should.eventually.be.rejected;
            });

            it('failed action still effective', function() {
                
                let existsFiles = [
                    'removed',
                    'folder/removed',
                    'untouched',
                    'folder/untouched'
                ];

                let action = new actionTypes.RemoveFileAction(
                    ['removed', 'folder/removed', 'notExists']
                );

                return initializeFolder(existsFiles, utils.PLAYGROUND_PATH)
                .then(() => {
                    return action.executeBy(actionExecutor)
                    .should.eventually.be.rejected;
                })
                .then(() => {
                    return Promise.all([
                        fs.access(path.join(utils.PLAYGROUND_PATH, 'removed'))
                        .should.eventually.be.rejected,
                        fs.access(path.join(utils.PLAYGROUND_PATH, 'folder/removed'))
                        .should.eventually.be.rejected,
                        fs.access(path.join(utils.PLAYGROUND_PATH, 'untouched'))
                        .should.eventually.be.fulfilled,
                        fs.access(path.join(utils.PLAYGROUND_PATH, 'folder/untouched'))
                        .should.eventually.be.fulfilled
                    ]);
                });
            })
        });

        describe('Move File', function() {

            it('move a file', function() {

                let sourceName = 'source';
                let targetName = 'target';
                let sourcePath = path.join(utils.PLAYGROUND_PATH, sourceName);
                let targetPath = path.join(utils.PLAYGROUND_PATH, targetName);
                let content = 'some contents';

                let action = new actionTypes.MoveFileAction(
                    sourceName,
                    targetName
                );

                return fs.writeFile(sourcePath, content)
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return Promise.all([
                        fs.exists(sourcePath).should.eventually.equal(false, `${sourcePath} should not exist`),
                        fs.exists(targetPath).should.eventually.equal(true, `${targetPath} should exists`)
                    ]);
                });
            });
        })
    });

    describe('Git Operations', function() {

        const archivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, repoArchiveName + '.zip');

        let repo;

        beforeEach('Load Testing Repos', function(){

            this.timeout(5000);

            return fs.emptyDir(workingPath)
            .then(() => {
                return zip.extractArchiveTo(archivePath, repoParentPath);
            })
            .then(() => {
                repo = simpleGitCtor(workingPath);
            })
            .then(() => {
                return repo.checkout(['-f', 'master']);
            })
            .then(() => {
                return repo.clean('f', ['-d']);
            });

        });

        after('Clear Testing Repo', function() {
            return fs.remove(repoParentPath);
        })

        describe('Stage', function() {

            it('stage single file', function() {

                let action = new actionTypes.StageAction(testRepoSetupName, ['newFile']);

                return fs.writeFile(path.join(workingPath, 'newFile'), 'newFileContent')
                .then(() => {
                    return fs.writeFile(path.join(workingPath, 'otherFile'), 'otherFileContent');
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({ 
                    created: ['newFile'],
                    not_added: ['otherFile']
                });
            });

            it('stage multiple files', function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    [ 'a.txt', 'c.txt', 'newFile', 'd.txt', 'renamed' ]
                );

                return fs.readFile(path.join(workingPath, 'a.txt'))
                .then(aContent => {
                    return fs.writeFile(
                        path.join(workingPath, 'a.txt'),
                        aContent + ' appended to ensure changing'
                    );
                })
                .then(() => {
                    return fs.remove(path.join(workingPath, 'c.txt'));
                })
                .then(() => {
                    return fs.writeFile(
                        path.join(workingPath, 'newFile'),
                        'some'
                    );
                })
                .then(() => {
                    return fs.rename(
                        path.join(workingPath, 'd.txt'),
                        path.join(workingPath, 'renamed')
                    );
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .then(status => {
                    return status;
                })
                .should.eventually.deep.include({
                    created: [ 'newFile' ],
                    deleted: [ 'c.txt' ],
                    modified: [ 'a.txt' ],
                    renamed: [ { from: 'd.txt', to: 'renamed' } ]
                });
            });

            it('stage with pattern', function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    ['*.txt']
                );

                return fs.writeFile(
                    path.join(workingPath, 'not_added'),
                    'some'
                )
                .then(() => {
                    return fs.writeFile(
                        path.join(workingPath, 'new1.txt'),
                        'some'
                    )
                    .then(() => {
                        return fs.writeFile(
                            path.join(workingPath, 'new2.txt'),
                            'someOther'
                        );
                    });
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({
                    created: [ 'new1.txt', 'new2.txt' ]
                });

            });

            it('stage all', function() {
                
                let action = new actionTypes.StageAllAction(testRepoSetupName);

                let fileNames = [ 'a.txt', 'c.txt', 'd.txt', 'e.txt', 'f.txt' ];
                let addedFolder = path.join(workingPath, 'newFolder', 'newFolder2');
                let addedFile = path.join(addedFolder, 'newFile')

                let removeAll = () => {
                    let removes = [];
                    fileNames.forEach(fileName => {
                        removes.push(fs.remove(path.join(workingPath, fileName)));
                    });
                    return Promise.all(removes);
                };

                return removeAll()
                .then(() => {
                    return fs.ensureDir(addedFolder)
                    .then(() => {
                        return fs.writeFile(addedFile, 'some content');
                    });
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({
                    deleted: fileNames,
                    created: [ 'newFolder/newFolder2/newFile' ]
                });
            });

            it('stage not matching no error', function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    [ 'not_exists' ]
                );

                return fs.writeFile(path.join(workingPath, 'newFile'), 'some content')
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({
                    not_added: [ 'newFile' ]
                });

            });

        });
    });

    describe.only('Repository Operations', function() {

        const referenceName = 'compare-vcs-local-ref';
        let repoReferenceManager;

        describe('Load Reference Operation', function() {

            before('Create Specialized ActionExecutor', function() {

                let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor/resources'));
                assetLoader.setBundlePath();

                let repoSetups = {
                    [testRepoSetupName]: new RepoVcsSetup(
                        path.relative(utils.PLAYGROUND_PATH, workingPath),
                        referenceName,
                        ''
                    )
                };

                actionExecutor = new ActionExecutor(utils.PLAYGROUND_PATH, assetLoader, repoSetups);
            });

            before('Initialize Working Path', function() {
                return fs.ensureDir(workingPath);
            })

            before('Load Reference Store', function() {
                return zip.extractArchiveTo(
                    path.join(utils.ARCHIVE_RESOURCES_PATH, referenceName) + '.zip', 
                    path.join(utils.PLAYGROUND_PATH, 'repoStore')
                )
                .then(() => {
                    return RepoReferenceManager.create(
                        workingPath,
                        path.join(utils.PLAYGROUND_PATH, 'repoStore'),
                        referenceName
                    );
                });
            });

            beforeEach('Clean Working Directory', function() {
                fs.emptyDirSync(workingPath);
            });


            describe('File System Aspect', function() {
                it('load into empty', function() {
                    
                    let action = new actionTypes.LoadReferenceAction(
                        testRepoSetupName,
                        'clean'
                    );

                    return action.executeBy(actionExecutor)
                    .then(() => {
                        return repoReferenceManager.equivaluent('clean');
                    })
                    .should.eventually.equal(true);
                });
        
                it('load into non-empty replace original', function() {
                    utils.notImplemented();
                });
        
                it('extra files are removed by loading', function() {
                    utils.notImplemented();
                });
            });

            describe('git Properties Aspect', function() {
                it('work tree status recoverd', function() {
                    utils.notImplemented();
                });

                it('stage status recoverd', function() {
                    utils.notImplemented();
                });

                it('merge conflict status recoverd', function() {
                    utils.notImplemented();
                });
            });

        });
        
    })
});