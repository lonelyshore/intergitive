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

const ActionExecutor = require("../../dev/action-executor").DevActionExecutor;
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const RepoSetup = require("../../lib/config-level").RepoVcsSetup;


chai.use(chaiAsPromised);
chai.should();

describe('Prepare VCS Compare #core', function() {

    let testingStorageTypes = [
        vcs.STORAGE_TYPE.ARCHIVE,
        // vcs.STORAGE_TYPE.GIT
    ];

    it('GENERATE_TESTS', function() {
        testingStorageTypes.forEach(testingStorageType => {
            createTests(testingStorageType);
        })
    });
});

function createTests(storageType) {

    describe(`VCS Compare #core - ${storageType} storage`, function() {

        this.timeout(4000);

        const archiveCreationConfigExecutor = new utils.RepoArchiveConfigExecutor();
    
        describe.only("Build Tree Equal", function() {
                
            const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");
    
            const checkedRepoPath = path.join(workingPath, "repo");
            const referenceStorePath = path.join(workingPath, "repo-store");
            const referenceStoreName = "compare-vcs-grow-local-ref";
    
            const referenceArchivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, `compare-vcs-grow-local-ref-${storageType.toLowerCase()}.zip`);
    
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
                    .then(() => zip.extractArchiveTo(referenceArchivePath, path.join(referenceStorePath, referenceStoreName)))
                })
                .then(() => {
                    repo = simpleGit(checkedRepoPath);
                    return repo.init(false)
                    .then(() => repo.addConfig("user.name", "test"))
                    .then(() => repo.addConfig("user.email", "test@test.server"))
                })
                .then(() => {
                    return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, storageType)
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
                        undefined,
                        assetLoader,
                        repoSetups
                    );
    
                });
            });
    
            after("Clean Up", function() {
                return fs.remove(workingPath)
            });
    
            const yamlPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-base-repo.yaml");
            let config = 
                archiveCreationConfigExecutor.loadConfigSync(
                    yamlPath
                );
            
            config.stageNames.forEach(stageName => {
    
                if (stageName !== "init") {
                    it(`execute ${stageName} should equal`, function() {
    
                        return archiveCreationConfigExecutor.executeStage(
                            stageName,
                            config.stageMap,
                            actionExecutor
                        )
                        .then(() => {
                            return vcsManager.equivalent(stageName);
                        })
                        .should.eventually.equal(true, `${stageName} is not equal`);
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
            const referenceArchivePath = path.join(archivePath, `compare-vcs-local-ref-${storageType.toLowerCase()}.zip`);
            const checkedArchivePath = path.join(archivePath, "compare-vcs.zip");
    
            let repo;
            let vcsManager;
            let stageMap = {};
            let actionExecutor;
    
            let resetCheckRepo = function() {
                return fs.remove(checkedRepoPath)
                .then(() => zip.extractArchiveTo(checkedArchivePath, checkedRepoPath))
                .then(() => repo = simpleGit(checkedRepoPath));
            }
    
            before(function() {
    
                const assetStorePath = path.join(utils.RESOURCES_PATH, "vcs-compare", "assets");
                const yamlPath = path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-testing-ref-repo.yaml");
                
                return Promise.resolve()
                .then(() => {
                    return fs.emptyDir(workingPath)
                    .then(() => fs.emptyDir(referenceStorePath))
                    .then(() => zip.extractArchiveTo(referenceArchivePath, path.join(referenceStorePath, referenceStoreName)))
                    .then(() => zip.extractArchiveTo(checkedArchivePath, checkedRepoPath));
                })
                .then(() => {
                    return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, storageType)
                    .then((manager) => {
                        vcsManager = manager;
                    });
                })
                .then(() => {
                    return archiveCreationConfigExecutor.loadConfig(yamlPath);
                })
                .then(result => {
                    stageMap = result.stageMap;
                    stageMap["clean"] = [];
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
                        undefined,
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
    
                    return archiveCreationConfigExecutor.executeStage(referenceName, stageMap, actionExecutor)
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
        
            describe.only("Different", function() {
        
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
                                    return archiveCreationConfigExecutor.executeStage(names[j], stageMap, actionExecutor)
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

                it("should differ from empty", function() {
                    return fs.emptyDir(checkedRepoPath)
                    .then(() => {
                        return vcsManager.equivalent('clean');
                    })
                    .should.eventually.equal(false, 'clean should not equal to an empty repo');
                });

                it("should differ from not existed", function() {
                    return fs.remove(checkedRepoPath)
                    .then(() => {
                        return vcsManager.equivalent('clean');
                    })
                    .should.eventually.equal(false, 'clean should not equal to a repo that is not existed');
                });
            });
        });
    });

}

