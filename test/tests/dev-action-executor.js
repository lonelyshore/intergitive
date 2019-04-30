"use strict";

"use strict";

const path = require("path");
const fs = require("fs-extra");
const zip = require("../../lib/simple-archive");
const simpleGitCtor = require("simple-git/promise");
const utils = require("./test-utils");
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const ActionExecutor = require("../../dev/action-executor").DevActionExecutor;
const RepoVcsSetup = require("../../lib/config-level").RepoVcsSetup;
const actionTypes = require("../../dev/config-action");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

const fail = function() {
    throw new Error("fail");
}

describe("Dev Action Executor", function() {

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
        });

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

        
        describe("Merge", function() {

            it("merge branches", function() {
                
                const toBranch = "mergable";
                const fromBranch = "master";

                let action = new actionTypes.MergeAction(
                    testRepoSetupName,
                    toBranch,
                    fromBranch
                );

                let toBranchSha;
                let fromBranchSha;
                let parentOneSha;
                let parentTwoSha;

                return repo.revparse([ toBranch, fromBranch ])
                .then(results => {
                    toBranchSha = results[0];
                    fromBranchSha = results[1];
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.revparse([ toBranch + "^1", toBranch + "^2" ])
                    .then(results => {
                        parentOneSha = results[0];
                        parentTwoSha = results[1];
                    })
                })
                .then(() => {
                    return parentOneSha === toBranchSha
                        && parentTwoSha === fromBranchSha;
                })
                .should.eventually.be.true;
                
            });

            it("merge conflict will stop", function() {
                
                const toBranch = "master";
                const fromBranch = "conflict-AA";

                let action = new actionTypes.MergeAction(
                    testRepoSetupName,
                    toBranch,
                    fromBranch
                );

                fail();
            });

            it("resolve conflict", function() {
                fail();
            });
        });

        describe("Clean Checkout", function() {

            it("checkout head", function() {
                fail();
            });

            it("checkout branch", function() {
                fail();
            });

            it("checkout refspec", function() {
                fail();
            })

            it("checkout sha", function() {
                fail();
            })
        })
    });
});