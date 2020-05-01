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

        let repoSetups = {
            [testRepoSetupName]: new RepoVcsSetup(
                path.relative(utils.PLAYGROUND_PATH, repoPath),
                "",
                ""
            )
        };

        actionExecutor = new ActionExecutor(
            utils.PLAYGROUND_PATH,
            undefined,
            assetLoader,
            repoSetups
        );
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

        describe.only('Arbitrary Git Command', function() {

            it('Parse dollar sign ($)', function() {

                const assetBasePath = 'git-operations';
                const replacedCommandId = `${assetBasePath}/replacedCommand`;
                const replacedArgId = `${assetBasePath}/replacedArgLocal`;
                const replacedVarNameId = `${assetBasePath}/replacedVarName`;

                const timestamp = Math.floor(Date.now() / 1000).toString();

                let action = new actionTypes.GitCommandAction(
                    testRepoSetupName,
                    [
                        `$${replacedCommandId}`,
                        `$${replacedArgId}`,
                        `$${replacedVarNameId}`,
                        `${timestamp}`
                    ]
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return repo.raw([
                        'config',
                        '--local',
                        '--get',
                        'unused.test'
                    ])
                    .then(result => {
                        return result.trim();
                    })
                    .should.eventually.equal(timestamp);
                });
            });

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
                
                const toBranch = "master";
                const fromBranch = "mergable";

                let action = new actionTypes.MergeAction(
                    testRepoSetupName,
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
                const fromBranch = "conflict-MM";

                let action = new actionTypes.MergeAction(
                    testRepoSetupName,
                    fromBranch
                );

                let currentSha;
                return repo.revparse([toBranch])
                .then(result => {
                    currentSha = result;
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.revparse(["HEAD"])
                    .then(result => {
                        result.should.equal(currentSha);
                    })
                    .then(() => {
                        return repo.status();
                    })
                    .then(result => {
                        result.should.deep.include({
                            conflicted: ["a.txt"]
                        });
                    });
                })
                .should.be.fulfilled;
            });
        });

        describe("Continue Merge", function() {

            it("resolve conflict", function() {
                
                const toBranch = "master";
                const fromBranch = "conflict-MM";

                let action = new actionTypes.MergeAction(
                    testRepoSetupName,
                    fromBranch
                );

                let stageAllAction = new actionTypes.StageAllAction(
                    testRepoSetupName
                );

                let continueAction = new actionTypes.ContinueMergeAction(
                    testRepoSetupName
                );

                let toSha;
                let fromSha;
                return repo.revparse([ toBranch, fromBranch ])
                .then(results => {
                    toSha = results[0];
                    fromSha = results[1];
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return fs.writeFile(path.join(repoPath, "a.txt"), "");
                })
                .then(() => {
                    return stageAllAction.executeBy(actionExecutor);
                })
                .then(() => {
                    return continueAction.executeBy(actionExecutor);
                })
                .then(() => {
                    return repo.revparse([ "HEAD^1", "HEAD^2" ])
                    .then(results => {
                        results[0].should.equal(toSha);
                        results[1].should.equal(fromSha);
                    });
                })
                .should.be.fulfilled;


            });   

        })

        describe("Clean Checkout", function() {

            const assertCleanAt = function(targetSha) {
                return repo.revparse(["HEAD"])
                .then(result => {
                    result.trim().should.equal(targetSha.trim());
                })
                .then(() => {
                    return repo.status();
                })
                .then(result => {
                    result.should.deep.include({
                        not_added: [],
                        conflicted: [],
                        created: [],
                        deleted: [],
                        modified: [],
                        renamed: [],
                        staged: []
                    });
                });
            };

            const assertCleanCheckout = function(commitish) {
                let action = new actionTypes.CleanCheckoutAction(
                    testRepoSetupName,
                    commitish
                );

                let targetSha
                return repo.revparse([commitish])
                .then(result => {
                    targetSha = result;
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return assertCleanAt(targetSha);
                })
                .should.be.fulfilled;                
            }

            it("checkout head", function() {
                
                let action = new actionTypes.CleanCheckoutAction(
                    testRepoSetupName,
                    "HEAD"
                );

                const newFileName = "newFile";
                const newStagedFileName = "newStageFile";
                const dirtyFileName = "a.txt";
                const dirtyStagedFileName = "c.txt";
                const removedFileName = "e.txt";
                const removedStagedFileName = "f.txt";

                let initialSha;

                return Promise.resolve()
                .then(() => {
                    return repo.revparse(["HEAD"])
                    .then(result => {
                        initialSha = result;
                    });
                })
                .then(() => {
                    return Promise.all([
                        fs.writeFile(path.join(repoPath, newFileName), newFileName),
                        fs.writeFile(path.join(repoPath, newStagedFileName), newStagedFileName),
                        fs.writeFile(path.join(repoPath, dirtyFileName), "cdnaifhdaifenfuidnafkldahfuief"),
                        fs.writeFile(path.join(repoPath, dirtyStagedFileName), "jfkdajfiomiofmdodfjdifjsdiofjdisofjsdop"),
                        fs.remove(removedFileName),
                        fs.remove(removedStagedFileName)
                    ]);
                })
                .then(() => {
                    return repo.add([ newStagedFileName, dirtyStagedFileName, removedStagedFileName ]);
                })
                .then(() => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return assertCleanAt(initialSha);
                })
                .should.be.fulfilled;
            });

            it("checkout branch", function() {
                return assertCleanCheckout("conflict-AA");
            });

            it("checkout refspec", function() {
                return assertCleanCheckout("HEAD~2");
            })

            it("checkout sha", function() {
                
                let targetSha;
                return repo.revparse(["conflict-MM"])
                .then(result => {
                    targetSha = result.trim();

                    return new actionTypes.CleanCheckoutAction(
                        testRepoSetupName,
                        targetSha
                    );
                })
                .then(action => {
                    return action.executeBy(actionExecutor);
                })
                .then(() => {
                    return assertCleanAt(targetSha);
                });
            })
        })
    });
});