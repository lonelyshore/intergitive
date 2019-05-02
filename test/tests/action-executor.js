"use strict";

"use strict";

const path = require("path");
const fs = require("fs-extra");
const zip = require("../../lib/simple-archive");
const simpleGitCtor = require("simple-git/promise");
const utils = require("./test-utils");
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const ActionExecutor = require("../../lib/action-executor").ActionExecutor;
const RepoVcsSetup = require("../../lib/config-level").RepoVcsSetup;
const actionTypes = require("../../lib/config-action");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();


describe("Action Executor #core", function() {

    let actionExecutor;
    const testRepoSetupName = "test-repo";
    const repoParentPath = path.join(utils.PLAYGROUND_PATH, "repo");
    const repoArchiveName = "action-executor";
    const repoPath = path.join(repoParentPath, repoArchiveName);    

    before(function() {
        let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, "action-executor/resources"));
        assetLoader.setBundlePath();

        let repoSetups = {
            [testRepoSetupName]: new RepoVcsSetup(
                repoPath,
                "",
                ""
            )
        };

        actionExecutor = new ActionExecutor(utils.PLAYGROUND_PATH, assetLoader, repoSetups);
    })

    describe("File Operations", function() {
            
        beforeEach("Initialize Playground", function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        });

        afterEach("Remove Playground", function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        describe("Write File", function() {

            /**
             * 
             * @param {string} str
             * @returns {string} 
             */
            const reverseString = function(str) {
                return str.split("").reverse().join("");
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

            const appendFolderName = function(fileSubPaths, folderName) {
                let ret = [];
                fileSubPaths.forEach(fileSubPath => {
                    ret.push(folderName + "/" + path.basename(fileSubPath));
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
                        return fs.readFile(path.join(baseFolder, fileSubPath), "utf8")
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

            it("files not overwritting", function() {
                
                let targets = ["manyFiles1", "manyFiles2"]
                let keys = appendFolderName(targets, "write-file");
                
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

            it("files overwritting", function() {

                let targets = ["manyFilesOverwritting1", "manyFilesOverwritting2"];
                let keys = appendFolderName(targets, "write-file");

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

            it("files inside path not overwritting", function() {
                
                let targets = ["manyFilesInPath1", "manyFilesInPath2"];
                let keys = appendFolderName(targets, "write-file");
                let destinations = appendFolderName(targets, "parent");

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

            it("files inside path overwritting", function() {
                
                let targets = ["manyFilesInPathOverwritting1", "manyFilesInPathOverwritting2"];
                let keys = appendFolderName(targets, "write-file");
                let destinations = appendFolderName(targets, "parent");

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

            it("unrelated files intact", function() {
                
                let targets = ["manyFiles1", "manyFiles2"];
                let keys = appendFolderName(targets, "write-file");
                let untouched = ["untouched1", "untouched2"];

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

            it("source not exist should fail", function() {
                
                let targets = ["not-exists"];
                let keys = appendFolderName(targets, "write-file");

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

            it("source not exist destination untouched", function() {
                
                let targets = ["not-exists"];
                let keys = appendFolderName(targets, "write-file");

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
    });

    describe("Git Operations", function() {

        const archivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, repoArchiveName + ".zip");

        let repo;

        beforeEach("Load Testing Repos", function(){

            this.timeout(5000);

            return fs.emptyDir(repoPath)
            .then(() => {
                return zip.extractArchiveTo(archivePath, repoParentPath);
            })
            .then(() => {
                repo = simpleGitCtor(repoPath);
            })
            .then(() => {
                return repo.checkout(["-f", "master"]);
            })
            .then(() => {
                return repo.clean("f", ["-d"]);
            });

        });

        after("Clear Testing Repo", function() {
            return fs.remove(repoParentPath);
        })

        describe("Stage", function() {

            it("stage single file", function() {

                let action = new actionTypes.StageAction(testRepoSetupName, ["newFile"]);

                return fs.writeFile(path.join(repoPath, "newFile"), "newFileContent")
                .then(() => {
                    return fs.writeFile(path.join(repoPath, "otherFile"), "otherFileContent");
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({ 
                    created: ["newFile"],
                    not_added: ["otherFile"]
                });
            });

            it("stage multiple files", function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    [ "a.txt", "c.txt", "newFile", "d.txt", "renamed" ]
                );

                return fs.readFile(path.join(repoPath, "a.txt"))
                .then(aContent => {
                    return fs.writeFile(
                        path.join(repoPath, "a.txt"),
                        aContent + " appended to ensure changing"
                    );
                })
                .then(() => {
                    return fs.remove(path.join(repoPath, "c.txt"));
                })
                .then(() => {
                    return fs.writeFile(
                        path.join(repoPath, "newFile"),
                        "some"
                    );
                })
                .then(() => {
                    return fs.rename(
                        path.join(repoPath, "d.txt"),
                        path.join(repoPath, "renamed")
                    );
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .then(status => {
                    let dummy = status;
                    return status;
                })
                .should.eventually.deep.include({
                    created: [ "newFile" ],
                    deleted: [ "c.txt" ],
                    modified: [ "a.txt" ],
                    renamed: [ { from: "d.txt", to: "renamed" } ]
                });
            });

            it("stage with pattern", function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    ["*.txt"]
                );

                return fs.writeFile(
                    path.join(repoPath, "not_added"),
                    "some"
                )
                .then(() => {
                    return fs.writeFile(
                        path.join(repoPath, "new1.txt"),
                        "some"
                    )
                    .then(() => {
                        return fs.writeFile(
                            path.join(repoPath, "new2.txt"),
                            "someOther"
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
                    created: [ "new1.txt", "new2.txt" ]
                });

            });

            it("stage all", function() {
                
                let action = new actionTypes.StageAllAction(testRepoSetupName);

                let fileNames = [ "a.txt", "c.txt", "d.txt", "e.txt", "f.txt" ];
                let addedFolder = path.join(repoPath, "newFolder", "newFolder2");
                let addedFile = path.join(addedFolder, "newFile")

                let removeAll = () => {
                    let removes = [];
                    fileNames.forEach(fileName => {
                        removes.push(fs.remove(path.join(repoPath, fileName)));
                    });
                    return Promise.all(removes);
                };

                return removeAll()
                .then(() => {
                    return fs.ensureDir(addedFolder)
                    .then(() => {
                        return fs.writeFile(addedFile, "some content");
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
                    created: [ "newFolder/newFolder2/newFile" ]
                });
            });

            it("stage not matching no error", function() {
                
                let action = new actionTypes.StageAction(
                    testRepoSetupName,
                    [ "not_exists" ]
                );

                return fs.writeFile(path.join(repoPath, "newFile"), "some content")
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.status();
                })
                .should.eventually.deep.include({
                    not_added: [ "newFile" ]
                });

            });

        });
    });
});