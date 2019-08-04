'use strict';

const path = require('path');
const fs = require('fs-extra');
const simpleGitCtor = require('simple-git/promise');

const eol = require('../../lib/text-eol');
const zip = require('../../lib/simple-archive');
const devParams = require('../../dev/parameters');
const normalizePathSep = require('../../lib/noarmalize-path-sep');

const utils = require('./test-utils');
const AssetLoader = require('../../lib/asset-loader').AssetLoader;
const ActionExecutor = require('../../lib/action-executor').ActionExecutor;
const RepoVcsSetup = require('../../lib/config-level').RepoVcsSetup;
const RepoReferenceManager = require('../../lib/repo-vcs').RepoReferenceManager;
const REPO_TYPE = require('../../lib/config-level').REPO_TYPE;
const actionTypes = require('../../lib/config-action');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();


describe('Action Executor #core', function() {

    let actionExecutor;
    const testRepoSetupName = 'test-repo';
    const testRemoteRepoSetupName = 'test-remote-repo';
    const alternativeRemoteRepoSetupName = 'test-remote-repo2';
    const repoParentPath = path.join(utils.PLAYGROUND_PATH, 'repo');
    const repoArchiveName = 'action-executor';
    const workingPath = path.join(repoParentPath, repoArchiveName);
    const remoteWorkingPath = path.join(repoParentPath, testRemoteRepoSetupName);
    const alternativeRemoteWorkingPath = path.join(repoParentPath, alternativeRemoteRepoSetupName);
    const repoStoreCollectionName = 'repo-store';
    const repoStoreCollectionPath = path.join(utils.PLAYGROUND_PATH, repoStoreCollectionName);

    before(function() {
        let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor', 'resources'));
        assetLoader.setBundlePath();

        let repoSetups = {
            [testRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, workingPath),
                '',
                '',
                REPO_TYPE.LOCAL
            ),
            [testRemoteRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, remoteWorkingPath),
                '',
                '',
                REPO_TYPE.REMOTE
            ),
            [alternativeRemoteRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, alternativeRemoteWorkingPath),
                '',
                '',
                REPO_TYPE.REMOTE
            )
        };

        actionExecutor = new ActionExecutor(
            utils.PLAYGROUND_PATH, 
            repoStoreCollectionName,
            assetLoader,
            repoSetups
        );
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

        describe('Remote Related', function() {

            let remoteRepo;

            beforeEach('Initialize Remote', function() {
                return fs.emptyDir(remoteWorkingPath)
                .then(() => {
                    return simpleGitCtor(remoteWorkingPath);
                })
                .then(result => {
                    remoteRepo = result;
                    return result.raw(['init', '--bare']);
                });
            });

            describe('Set Remote', function() {

                it('set new remote', function() {
    
                    let remoteNickName = 'kerker';
    
                    let action = new actionTypes.SetRemoteAction(
                        testRepoSetupName,
                        testRemoteRepoSetupName,
                        remoteNickName
                    );

                    return action.executeBy(actionExecutor)
                    .then(() => repo.raw(['remote', 'show']))
                    .then(result => {
                        return result.trim();
                    })
                    .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`)
                    .then(() => {
                        return repo.raw(['remote', 'get-url', remoteNickName])
                    })
                    .then(result => {
                        return normalizePathSep.posix(result.trim());
                    })
                    .should.eventually.equal(
                        normalizePathSep.posix(remoteWorkingPath.trim()),
                        `Expect remote ${remoteNickName} to have url ${remoteWorkingPath}`
                    );
                });
    
                it('overwrites old remote, no warning', function() {

                    let remoteNickName = 'kerker';
    
                    let action1 = new actionTypes.SetRemoteAction(
                        testRepoSetupName,
                        testRemoteRepoSetupName,                        
                        remoteNickName
                    );

                    let action2 = new actionTypes.SetRemoteAction(
                        testRepoSetupName,
                        alternativeRemoteRepoSetupName,
                        remoteNickName
                    );

                    return action1.executeBy(actionExecutor)
                    .then(() => {
                        return repo.raw(['remote', 'show'])
                        .then(result => {
                            return result.trim();
                        })
                        .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`);
                    })
                    .then(() => {
                        return action2.executeBy(actionExecutor);
                    })
                    .then(() => {
                        return repo.raw(['remote', 'show'])
                        .then(result => {
                            return result.trim();
                        })
                        .should.eventually.equal(remoteNickName, `Expect to have remote ${remoteNickName}`)
                        .then(() => {
                            return repo.raw(['remote', 'get-url', remoteNickName]);
                        })
                        .then(result => {
                            return normalizePathSep.posix(result.trim());
                        })
                        .should.eventually.equal(
                            normalizePathSep.posix(alternativeRemoteWorkingPath),
                            `Expect remote ${remoteNickName} to have url ${alternativeRemoteWorkingPath}`
                        )
                    })
                });
    
            })
    
            describe.only('Push', function() {
    
                let remoteNickName = 'kerker';

                function ParseRefs(refs) {
                    let lines = refs.split('\n');
                
                    let locals = {};
                    let remotes = {};
                    let misc = {};
                
                    lines.forEach(line => {
                        let tokens = line.split(' ');
                
                        if (tokens.length === 2) {
                            let refPath = tokens[1].slice(5);
                            if (refPath.startsWith('heads/')) {
                                locals[refPath.slice(6)] = tokens[0];
                            }
                            else if (refPath.startsWith('remotes/')) {
                                let remotePath = refPath.slice(8);
                                let slashIndex = remotePath.indexOf('/');
                
                                let remoteName = remotePath.slice(0, slashIndex);
                                if (!(remoteName in remotes)) {
                                    remotes[remoteName] = {};
                                }
                
                                remotes[remoteName][remotePath.slice(slashIndex + 1)] = tokens[0];
                            }
                            else {
                                misc[refPath] = tokens[0];
                            }
                        }
                    });
                
                    return {
                        locals: locals,
                        remotes: remotes,
                        misc: misc
                    };
                }

                function AssertRemoteUpdated(localRefs, remoteRefs, remoteName, matchedRefs) {

                    chai.expect(localRefs.remotes).to.have.property(remoteName);

                    let locals = localRefs.locals;
                    let localRemotes = localRefs.remotes[remoteName];
                    let remotes = remoteRefs.locals;

                    matchedRefs.forEach(matchedRef => {
                        chai.expect(localRemotes).to.have.property(matchedRef);
                        chai.expect(localRemotes[matchedRef]).to.equal(locals[matchedRef], `expect local remote cache [${matchedRef}] match with local[${matchedRef}]`);
                        chai.expect(remotes).to.have.property(matchedRef);
                        chai.expect(remotes[matchedRef]).to.equal(locals[matchedRef], `expect remote[${matchedRef}] match with local:remote[${matchedRef}]`);
                    });
                }

                beforeEach('Set Remote', function() {
                    let action = new actionTypes.SetRemoteAction(
                        testRepoSetupName,
                        testRemoteRepoSetupName,
                        remoteNickName
                    );

                    return action.executeBy(actionExecutor);
                });

                it('normal push single, remote exists', function() {

                    let targetRef = 'master'

                    let action = new actionTypes.PushAction(
                        testRepoSetupName,
                        remoteNickName,
                        `refs/heads/${targetRef}:refs/heads/${targetRef}`
                    );

                    let localRepoRefsBefore;
                    let localRepoRefsAfter;
                    let remoteRepoRefsAfter;

                    return repo.raw(['show-ref', '-d'])
                    .then(result => {
                        localRepoRefsBefore = ParseRefs(result);
                    })
                    .then(() => {
                        chai.expect(localRepoRefsBefore.remotes).to.be.empty;
                    })
                    .then(() => {
                        return action.executeBy(actionExecutor);
                    })
                    .then(() => {
                        return Promise.all([
                            repo.raw(['show-ref', '-d']),
                            remoteRepo.raw(['show-ref', '-d'])
                        ]);
                    })
                    .then(results => {
                        localRepoRefsAfter = ParseRefs(results[0]);
                        remoteRepoRefsAfter = ParseRefs(results[1]);
                    })
                    .then(() => {
                        AssertRemoteUpdated(
                            localRepoRefsAfter,
                            remoteRepoRefsAfter,
                            remoteNickName,
                            [ targetRef ]
                        );
                    });
    
                });

                it('normal push single, remote not exists fails', function() {

                    this.timeout(5000);

                    let targetRef = 'master'

                    let action = new actionTypes.PushAction(
                        testRepoSetupName,
                        remoteNickName,
                        `refs/heads/${targetRef}:refs/heads/${targetRef}`
                    );

                    return fs.remove(remoteWorkingPath)
                    .then(() => {
                        return action.executeBy(actionExecutor)
                        .should.be.rejected;
                    });
                });

                it('push update single', function() {

                    let targetRef = 'master'

                    let action = new actionTypes.PushAction(
                        testRepoSetupName,
                        remoteNickName,
                        `refs/heads/${targetRef}:refs/heads/${targetRef}`
                    );

                    let localRefFirstPush;
                    let localRefSecondPush;

                    return action.executeBy(actionExecutor)
                    .then(() => {
                        let remoteRefs;

                        return repo.raw(['show-ref', '-d'])
                        .then(result => {
                            localRefFirstPush = ParseRefs(result);
                        })
                        .then(() => {
                            return remoteRepo.raw(['show-ref', '-d'])
                        })
                        .then(result => {
                            remoteRefs = ParseRefs(result);
                        })
                        .then(() => {
                            AssertRemoteUpdated(
                                localRefFirstPush,
                                remoteRefs,
                                remoteNickName,
                                [ targetRef ]
                            );

                            chai.expect(Object.keys(localRefFirstPush.remotes[remoteNickName]))
                            .to.have.lengthOf(1);
                        });
                    })
                    .then(() => {
                        // Move master forward
                        return repo.checkout(['-f', targetRef])
                        .then(() => {
                            return fs.writeFile(
                                path.join(workingPath, 'some_new'),
                                'some content'
                            )
                        })
                        .then(() => {
                            return repo.add(['some_new']);
                        })
                        .then(() => {
                            return repo.commit('new');
                        });
                    })
                    .then(() => {
                        return action.executeBy(actionExecutor);
                    })
                    .then(() => {
                        let remoteRefs;

                        return repo.raw(['show-ref', '-d'])
                        .then(result => {
                            localRefSecondPush = ParseRefs(result);
                        })
                        .then(() => {
                            return remoteRepo.raw(['show-ref', '-d'])
                        })
                        .then(result => {
                            remoteRefs = ParseRefs(result);
                        })
                        .then(() => {
                            AssertRemoteUpdated(
                                localRefSecondPush,
                                remoteRefs,
                                remoteNickName,
                                [ targetRef ]
                            );

                            chai.expect(Object.keys(localRefSecondPush.remotes[remoteNickName]))
                            .to.have.lengthOf(1);

                            chai.expect(localRefFirstPush.remotes[remoteNickName][targetRef])
                            .to.not.equal(localRefSecondPush.remotes[remoteNickName][targetRef]);
                        });
                    });
                })

                it('push update all', function() {

                });

                it('force push single', function() {

                });

                it('force push all', function() {

                });
            })
        })


    });

    describe('Repository Operations', function() {

        describe('Local', function() {
            const refStoreName = 'compare-vcs-local-ref-' + devParams.defaultRepoStorageTypeName;
            const checkpointStoreName = 'checkpoint-store';

            before('Create Specialized ActionExecutor', function() {

                let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, 'action-executor/resources'));
                assetLoader.setBundlePath();

                let repoSetups = {
                    [testRepoSetupName]: new RepoVcsSetup(
                        path.relative(utils.PLAYGROUND_PATH, workingPath),
                        refStoreName,
                        checkpointStoreName
                    )
                };

                actionExecutor = new ActionExecutor(
                    utils.PLAYGROUND_PATH,
                    repoStoreCollectionName,
                    assetLoader,
                    repoSetups
                );
            });

            before('Load Reference Store', function() {
                return fs.emptyDir(repoStoreCollectionPath)
                .then(() => {
                    return zip.extractArchiveTo(
                        path.join(utils.ARCHIVE_RESOURCES_PATH, refStoreName) + '.zip', 
                        path.join(repoStoreCollectionPath, refStoreName)
                    );
                });
            });

            beforeEach('Clean Working Directory', function() {
                fs.emptyDirSync(workingPath);
            });

            after('Clean Up', function() {
                return fs.remove(workingPath)
                .then(() => fs.remove(repoStoreCollectionPath));
            })

            // We don't need to verify restored cotent, it is covered by
            // repo-save-restore
            it('load reference to correct location', function() {
                
                let action = new actionTypes.LoadReferenceAction(
                    testRepoSetupName,
                    'clean'
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return fs.exists(workingPath);
                })
                .should.eventually.equal(true)
                .then(() => {
                    return fs.exists(path.join(workingPath, '.git'));
                })
                .should.eventually.equal(true);
            });

            it('load multiple times do not break', function() {
                let action1 = new actionTypes.LoadReferenceAction(
                    testRepoSetupName,
                    'clean'
                );

                let action2 = new actionTypes.LoadReferenceAction(
                    testRepoSetupName,
                    'conflictResolveStage'
                );

                let action3 = new actionTypes.LoadReferenceAction(
                    testRepoSetupName,
                    'detached'
                );

                let isRestored = () => {
                    return fs.exists(workingPath)
                    .should.eventually.equal(true)
                    .then(() => {
                        return fs.exists(path.join(workingPath, '.git'));
                    })
                    .should.eventually.equal(true);
                };

                return action1.executeBy(actionExecutor)
                .then(() => {
                    return isRestored();
                })
                .then(() => {
                    return fs.remove(workingPath);
                })
                .then(() => {
                    return action2.executeBy(actionExecutor);
                })
                .then(() => {
                    return isRestored();
                })
                .then(() => {
                    return action3.executeBy(actionExecutor);
                })
                .then(() => {
                    return isRestored();
                })
            });

            it('save and load checkpoint', function() {

                let checkpointName = 'check';

                let backupAction = new actionTypes.SaveCheckpointAction(
                    testRepoSetupName,
                    checkpointName
                );

                let restoreAction = new actionTypes.LoadCheckpointAction(
                    testRepoSetupName,
                    checkpointName
                );

                return fs.emptyDir(workingPath)
                .then(() => {
                    return fs.writeFile(
                        path.join(workingPath, '123'),
                        'ABC',
                        {
                            encoding: 'utf8'
                        }
                    );
                })
                .then(() => {
                    return backupAction.executeBy(actionExecutor);
                })
                .then(() => {
                    return fs.remove(workingPath);
                })
                .then(() => {
                    return restoreAction.executeBy(actionExecutor);
                })
                .then(() => {
                    return fs.readdir(workingPath)
                    .should.eventually.have.length(1)
                    .and.include.members(['123']);
                })
                .then(() => {
                    return fs.readFile(
                        path.join(workingPath, '123'),
                        {
                            encoding: 'utf8'
                        }
                    )
                    .should.eventually.equal('ABC');
                });
            });

            it('load reference then compare should be equal', function() {
                let loadAction = new actionTypes.LoadReferenceAction(
                    testRepoSetupName,
                    'clean'
                );

                let compareActionEqual = new actionTypes.CompareReferenceAction(
                    testRepoSetupName,
                    'clean'
                );

                let compareActionUnequal = new actionTypes.CompareReferenceAction(
                    testRepoSetupName,
                    'dirtyAdd'
                );

                return loadAction.executeBy(actionExecutor)
                .then(() => {
                    return compareActionEqual.executeBy(actionExecutor);
                })
                .should.eventually.equal(true)
                .then(() => {
                    return compareActionUnequal.executeBy(actionExecutor);
                })
                .should.eventually.equal(false);
            })
        });
        
    })
});