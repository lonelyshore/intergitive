"use strict";

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
const simpleGit = require("simple-git/promise");
const utils = require("./test-utils");
const devParams = require('../../dev/parameters');

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

    const executeStage = function(stageName, stageMap, actionExecutor) {

        if (!(stageName in stageMap)) {
            return Promise.reject(new Error(`Cannot find find stageName ${stageName}`));
        }

        let contents = stageMap[stageName];

        let executions = Promise.resolve();
        executions = tryApplyReplay(executions, contents, stageMap, actionExecutor);
        executions = executions.then(() => executeContents(contents, actionExecutor));
        return executions;
    }

    describe("Build Tree Equal", function() {
            
        const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");

        const checkedRepoPath = path.join(workingPath, "repo");
        const referenceStorePath = path.join(workingPath, "repo-store");
        const referenceStoreName = "compare-vcs-grow-local-ref";

        const referenceArchivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, referenceStoreName + '.zip');

        let repo;
        let vcsManager;
        let actionExecutor;

        before(function() {

            const assetStorePath = path.join(utils.RESOURCES_PATH, "vcs-compare", "assets");
            
            return Promise.resolve()
            .then(() => {
                return fs.emptyDir(workingPath)
                .then(() => fs.emptyDir(checkedRepoPath))
                .then(() => fs.emptyDir(referenceStorePath))
                .then(() => zip.extractArchiveTo(referenceArchivePath, referenceStorePath))
            })
            .then(() => {
                repo = simpleGit(checkedRepoPath);
                return repo.init(false)
                .then(() => repo.addConfig("user.name", "test"))
                .then(() => repo.addConfig("user.email", "test@test.server"))
            })
            .then(() => {
                return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, devParams.defaultRepoStorageType)
                .then((manager) => {
                    vcsManager = manager;
                });
            })
            .then(() => {
                const assetLoader = new AssetLoader(assetStorePath);
                assetLoader.setBundlePath();

                const repoSetups = {
                    repo: new RepoSetup(
                        path.relative(workingPath, checkedRepoPath),
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
            return fs.remove(workingPath)
        });

        const yamlPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-base-repo.yaml");

        let content = fs.readFileSync(yamlPath);
        let config = yaml.safeLoad(content, { schema: SCHEMA });

        let stageMap = {}
        config.stages.forEach(stage => {

            stageMap[stage.name] = stage.contents

            if (stage.name !== "init") {
                it(`execute ${stage.name} should equal`, function() {

                    return executeStage(stage.name, stageMap, actionExecutor)
                    .then(() => {
                        return vcsManager.equivalent(stage.name);
                    })
                    .should.eventually.equal(true, `${stage.name} is not equal`);
                })
            }

        });


    })

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
            return fs.remove(checkedRepoPath)
            .then(() => zip.extractArchiveTo(checkedArchivePath, workingPath))
            .then(() => {
                return fs.move(
                    path.join(workingPath, 'compare-vcs'),
                    checkedRepoPath
                )
            })
            .then(() => repo = simpleGit(checkedRepoPath));
        }

        before(function() {

            const assetStorePath = path.join(utils.RESOURCES_PATH, "vcs-compare", "assets");
            const yamlPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-testing-ref-repo.yaml");
            
            return Promise.resolve()
            .then(() => {
                return fs.emptyDir(workingPath)
                .then(() => fs.emptyDir(referenceStorePath))
                .then(() => zip.extractArchiveTo(referenceArchivePath, referenceStorePath))
                .then(() => zip.extractArchiveTo(checkedArchivePath, workingPath))
                .then(() => {
                    return fs.move(
                        path.join(workingPath, 'compare-vcs'),
                        checkedRepoPath
                    );
                })
            })
            .then(() => {
                return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, devParams.defaultRepoStorageType)
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
                    config.stages.forEach(stage => {
                        stageMap[stage.name] = stage.contents;
                    });
                    stageMap["clean"] = [];
                })
            })
            .then(() => {
                const assetLoader = new AssetLoader(assetStorePath);
                assetLoader.setBundlePath();

                const repoSetups = {
                    repo: new RepoSetup(
                        path.relative(workingPath, checkedRepoPath),
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

                return executeStage(referenceName, stageMap, actionExecutor)
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
    
            it("merging conflict both added", function() {
                return testForReferencename("conflictAA");
            });

            it("merging conflict both modified", function() {
                return testForReferencename("conflictMM");
            });

            it("merging conflict modified and removed", function() {
                return testForReferencename("conflictMR");
            })

            it("merging conflict mixed", function(){
                return testForReferencename("conflictMixed");
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

            it("New Commit", function() {
                return repo.reset(["--mixed", "HEAD^"])
                .then(() => repo.add(["-A"]))
                .then(() => repo.commit(["Add fifth"]))
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(true, "Creating a commit with same files and message should be equivalent")
            })
        });
    
        describe("Different", function() {
    
            describe("Dirty Combination", function() {
                let names = [ 
                    "clean", 
                    "dirtyAdd", "dirtyRemove", "dirtyModify", "dirtyMixed",
                    "dirtyAddStage", "dirtyRemoveStage", "dirtyModifyStage", "dirtyMixedStage"
                ];

                for (let i = 0; i < names.length; i++) {
                    for (let j = 0; j < names.length; j++) {
                        if (i !== j) {
                            let additionalTag = i !== 0 && j !== 0 ? " #extensive" : "";
                            it(`template ${names[i]} against ${names[j]}${additionalTag}`, function() {
                                let referenceName = names[i];
                                return executeStage(names[j], stageMap, actionExecutor)
                                .then(() => {
                                    return vcsManager.equivalent(referenceName)
                                })
                                .should.eventually.equal(false, `expect reference ${names[i]} to differ from monitored path ${names[j]}`);
                            })
                        }
                    }
                }
            })

            it("differ working tree", function() {

                return vcsManager.equivalent("dirtyAdd")
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

                return vcsManager.equivalent("dirtyAddStage")
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
                        return vcsManager.equivalent("dirtyAddStage")
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
                        return vcsManager.equivalent("dirtyAddStage")
                        .should.eventually.equal(false, "different stage results in inequivalence");
                    });
                })
            });

            it("differ branch", function() {
                return repo.checkout(["-f", "master~0"])
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(false, "expect different after being detached")
                .then(() => repo.checkout(["-f", "second-branch"]))
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(false, "expect different after checking out another branch");
            });

            it("different branch list", function() {
                return repo.branch(["new_branch"])
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(false, "expect different after create a new branch")
                .then(() => repo.branch(["-D", "new_branch"]))
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(true, "expect to be equivalent to clean after delete the branch just created")
                .then(() => repo.branch(["-D", "second-branch"]))
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(false, "expect to differ from clean after remove a branch");
            });

            it("differ HEAD", function() {
                let currentSha;
                return repo.revparse(["HEAD"])
                .then(result => currentSha = result.trim())
                .then(() => repo.reset(["--soft", "HEAD^"]))
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(false, "expect to differ from clean after reset HEAD")
                .then(() => {
                    return repo.reset(["--soft", currentSha]);
                })
                .then(() => vcsManager.equivalent("clean"))
                .should.eventually.equal(true, "expect to be equivalent to clean after reset back");
            });
        });
    });
});