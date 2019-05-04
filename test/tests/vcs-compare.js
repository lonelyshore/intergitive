"use strict";

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const simpleGit = require("simple-git/promise");
const utils = require("./test-utils");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const zip = require("../../lib/simple-archive");
const vcs = require("../../lib/repo-vcs");

const Action = require("../../lib/config-action").Action;
const ActionExecutor = require("../../dev/action-executor").DevActionExecutor;
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const RepoSetup = require("../../lib/config-level").RepoVcsSetup;
const SCHEMA = require("../../dev/config-schema").LEVEL_CONFIG_SCHEMA;

chai.use(chaiAsPromised);
chai.should();

describe("VCS Compare #core", function() {

    /**
     * 
     * @param {Array<Any>} contents 
     * @param {ActionExecutor} actionExecutor 
     */
    const executeContents = function(contents, actionExecutor) {
        let executions = Promise.resolve();
        contents.forEach(item => {
            if (item instanceof Action) {
                executions = executions.then(() => {
                    return item.executeBy(actionExecutor)
                    .catch(err => {
                        console.error(`[execute ${item.klass}] ${err.message}`);
                        throw err;
                    });
                });
            }
        })

        return executions;
    }

    const tryApplyReplay = function(executions, contents, stageMap, actionExecutor) {

        if (contents.length !== 0 && ("replay" in contents[0])) {
            let replayContents = [];
            contents[0]["replay"].forEach(replayName => {
                replayContents = replayContents.concat(stageMap[replayName]);
            });

            executions = executions.then(() => executeContents(replayContents, actionExecutor));
        }

        return executions;
    }

    const executeStage = function(contents, stageMap, actionExecutor) {
        let executions = Promise.resolve();
        executions = tryApplyReplay(executions, contents, stageMap, actionExecutor);
        executions = executions.then(() => executeContents(contents, actionExecutor));
        return executions;
    }

    describe("Local", function() {

        const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");

        const checkedRepoPath = path.join(workingPath, "repo");
        const referenceStorePath = path.join(workingPath, "repo-store");
        const referenceStoreName = "compare-vcs-local-ref";

        const archivePath = path.join(utils.RESOURCES_PATH, "repo-archive");
        const referenceArchivePath = path.join(archivePath, "compare-vcs-local-ref.zip");
        const checkedArchivePath = path.join(archivePath, "compare-vcs.zip");

        let repo;
        let vcsManager;
        let stageMap = {};
        let actionExecutor;

        let resetCheckRepo = function() {
            return fs.emptyDir(checkedRepoPath)
            .then(() => zip.extractArchiveTo(checkedArchivePath, workingPath))
            .then(() => repo = simpleGit(checkedRepoPath));
        }

        before(function() {

            const assetStorePath = path.join(utils.RESOURCES_PATH, "vcs-compare", "assets");
            const yamlPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate.yaml");
            
            return Promise.resolve()
            .then(() => {
                return fs.emptyDir(workingPath)
                .then(() => fs.emptyDir(referenceStorePath))
                .then(() => zip.extractArchiveTo(referenceArchivePath, referenceStorePath))
                .then(() => zip.extractArchiveTo(checkedArchivePath, workingPath))
            })
            .then(() => {
                return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName)
                .then((manager) => {
                    vcsManager = manager;
                });
            })
            .then(() => {
                return fs.readFile(yamlPath)
                .then(content => {
                    return yaml.safeLoad(content, { schema: SCHEMA });
                })
                .then(config => {
                    config.actions.forEach(action => {
                        stageMap[action.name] = action.contents;
                    });
                })
            })
            .then(() => {
                const assetLoader = new AssetLoader(assetStorePath);
                assetLoader.setBundlePath();

                const repoSetups = {
                    compare: new RepoSetup(
                        checkedRepoPath,
                        undefined,
                        undefined
                    )
                };

                actionExecutor = new ActionExecutor(
                    workingPath,
                    assetLoader,
                    repoSetups
                );

            });
        });

        after("Clean Up", function() {
            return fs.emptyDir(workingPath)
            .then(() => fs.remove(workingPath));
        });

        beforeEach("Reset Checked Repository", function() {
            return resetCheckRepo()
        });

        describe("Equal", function() {

            const testForReferencename = (referenceName) => {
                return executeStage(stageMap[referenceName], stageMap, actionExecutor)
                .then(() => {
                    return vcsManager.equivalent(referenceName);
                })
                .should.eventually.equal(true, `${referenceName} is not equal`);
            }

            it("clean stage and working directory", function() {
                const referenceName = "clean";
                return vcsManager.equivalent(referenceName)
                .should.eventually.equal(true);
            });

            it("dirty working directory", function() {
                return testForReferencename("dirtyAdd")
                .then(() => {
                    return fs.remove(path.join(checkedRepoPath, "folder", "some_new"));
                })
                .then(() => testForReferencename("dirtyRemove"))
                .then(() => {
                    return repo.checkout(["-f"]);
                })
                .then(() => testForReferencename("dirtyModify"))
                .then(() => {
                    return repo.checkout(["-f"]);
                })
                .then(() => testForReferencename("dirtyMixed"));
            });
    
            it("dirty stage", function() {
                return testForReferencename("dirtyAddStage")
                .then(() => {
                    return repo.checkout(["-f"]);
                })
                .then(() => testForReferencename("dirtyRemoveStage"))
                .then(() => {
                    return repo.checkout(["-f"]);
                })
                .then(() => testForReferencename("dirtyModifyStage"))
                .then(() => {
                    return repo.checkout(["-f"]);
                })
                .then(() => testForReferencename("dirtyMixedStage"));
            });
    
            it("merged", function() {
                const referenceName = "merge";
                return testForReferencename(referenceName);
            });
    
            it("merging conflict", function() {
                const referenceName = "conflict";
                return testForReferencename(referenceName);
            });
    
            it("merging conflict editted", function() {
                const referenceName = "conclictEdit";
                return testForReferencename(referenceName);
            });

            it("merging conflict staged", function() {
                const referenceName = "conflictResolveStage";
                return testForReferencename(referenceName);
            });
    
            it("merging conflict resolved", function() {
                const referenceName = "conflictResolve";
                return testForReferencename(referenceName); 
            });
    
            it("detached head", function() {
                const referenceName = "detached";
                return testForReferencename(referenceName);
            });
        });
    
        describe("Different", function() {
    
            let repo;

            beforeEach("Initialize repo", function() {
                repo = simpleGit(checkedRepoPath);
            })

            it("differ working tree", function() {

                return vcsManager.equivalent("dirty")
                .should.eventually.equal(false, "clean should differ from dirty tree")
                .then(() => {
                    return fs.writeFile(
                        path.join(checkedRepoPath, "random"),
                        "fjfdkjviome"
                    )
                    .then(() => {
                        return vcsManager.equivalent("clean");
                    });
                })
                .should.eventually.equal(false, "dirty working tree should differ from clean");
            });

            it("differ index", function() {

                return vcsManager.equivalent("dirtyStage")
                .should.eventually.equal(false, "clean should differ from dirty stage")
                .then(() => {
                    return fs.writeFile(
                        path.join(checkedRepoPath, "random"),
                        "fjfdkjviome"
                    )
                    .then(() => {
                        return repo.add(["random"]);
                    })
                    .then(() => {
                        return vcsManager.equivalent("clean");
                    })
                    .should.eventually.equal(false, "staged a new file should differ from clean")
                    .then(() => {
                        return vcsManager.equivalent("dirtyStage")
                    })
                    .should.eventually.equal(false, "staging different file should result inequivalence");
                })
                .then(() => {
                    return repo.checkout(["-f"])
                    .then(() => {
                        return fs.remove(
                            path.join(checkedRepoPath, "random")
                        )
                    })
                    .then(() => {
                        return vcsManager.equivalent("clean");
                    })
                    .should.eventually.equal(true, "cleared repo should be equivalent to clean");
                })
                .then(() => {
                    return fs.remove(
                        path.join(checkedRepoPath, "first_file")
                    )
                    .then(() => {
                        return repo.add(["first_file"]);
                    })
                    .then(() => {
                        return vcsManager.equivalent("clean")
                        .should.eventually.equal(false, "staging removed file should differ from clean");
                    })
                    .then(() => {
                        return vcsManager.equivalent("dirtyStage")
                        .should.eventually.equal(false, "different stage results in inequivalence");
                    });
                })
            });

            it("differ branch", function() {

            });

            it("different branch list", function() {

            });

            it("differ HEAD", function() {

            });
        });
    });
});