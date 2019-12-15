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
        //vcs.STORAGE_TYPE.GIT
    ];

    it('GENERATE_TESTS', function() {
        testingStorageTypes.forEach(testingStorageType => {
            createTests(testingStorageType);
        })
    });
});

function createTests(storageType) {

    describe(`VCS Compare #core - ${vcs.STORAGE_TYPE.toString(storageType)} storage`, function() {

        this.timeout(4000);

        const archiveCreationConfigExecutor = new utils.RepoArchiveConfigExecutor();
    
        describe("Build Tree Equal", function() {

            const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");
    
            const referenceStorePath = path.join(workingPath, "repo-store");
            const referenceStoreName = "compare-vcs-grow-local-ref";
    
            const referenceArchivePath = path.join(utils.ARCHIVE_RESOURCES_PATH, `compare-vcs-grow-local-ref-${vcs.STORAGE_TYPE.toString(storageType)}.zip`);

            const yamlPath = 
                path.join(utils.RESOURCES_PATH, "vcs-compare", "generate-base-repo.yaml");
            let config = 
                archiveCreationConfigExecutor.loadConfigSync(
                    yamlPath
                );
    
            let repo;
            let vcsManager;
            let actionExecutor;
            let checkedRepoPath;
    
            before(function() {
    
                const assetStorePath = path.join(utils.RESOURCES_PATH, "vcs-compare", "assets");
                
                return Promise.resolve()
                .then(() => {
                    const assetLoader = new AssetLoader(assetStorePath);
                    assetLoader.setBundlePath();
    
                    const repoSetups = 
                        archiveCreationConfigExecutor
                        .createRepoVcsSetupsFromConfig(config);
    
                    actionExecutor = new ActionExecutor(
                        workingPath,
                        undefined,
                        assetLoader,
                        repoSetups
                    );

                    checkedRepoPath = actionExecutor.getRepoFullPaths('local').fullWorkingPath;
    
                })
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
                    return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, false, storageType)
                    .then((manager) => {
                        vcsManager = manager;
                    });
                });
            });
    
            after("Clean Up", function() {
                return fs.remove(workingPath)
            });
    

            
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
    
    
        });
    
        describe("Local", function() {

            const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");
    
            
            const referenceStorePath = path.join(workingPath, "repo-store");
            const referenceStoreName = "compare-vcs-local-ref";
    
            const archivePath = path.join(utils.RESOURCES_PATH, "repo-archive");
            const referenceArchivePath = path.join(archivePath, `compare-vcs-local-ref-${vcs.STORAGE_TYPE.toString(storageType)}.zip`);
            const checkedArchivePath = path.join(archivePath, "compare-vcs.zip");
    
            let repo;
            let vcsManager;
            let stageMap = {};
            let actionExecutor;
            let checkedRepoPath;
    
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
                    return archiveCreationConfigExecutor.loadConfig(yamlPath);
                })
                .then(config => {
                    stageMap = config.stageMap;

                    const assetLoader = new AssetLoader(assetStorePath);
                    assetLoader.setBundlePath();
    
                    const repoSetups = 
                        archiveCreationConfigExecutor.createRepoVcsSetupsFromConfig(
                            config
                        );
    
                    actionExecutor = new ActionExecutor(
                        workingPath,
                        undefined,
                        assetLoader,
                        repoSetups,
                        storageType
                    );
    
                    checkedRepoPath = 
                        actionExecutor
                        .getRepoFullPaths('local')
                        .fullWorkingPath;
                })
                .then(() => {
                    return fs.emptyDir(workingPath)
                    .then(() => fs.emptyDir(referenceStorePath))
                    .then(() => zip.extractArchiveTo(referenceArchivePath, path.join(referenceStorePath, referenceStoreName)))
                    .then(() => zip.extractArchiveTo(checkedArchivePath, checkedRepoPath));
                })
                .then(() => {
                    return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName, false, storageType)
                    .then((manager) => {
                        vcsManager = manager;
                    });
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

                it('clean and change user name and email', function() {
                    return repo.raw(['config', '--local', 'user.name', 'some other'])
                    .then(() => {
                        return vcsManager.equivalent('clean')
                        .should.eventually.equal(true);
                    })
                    .then(() => {
                        return repo.raw(['config', '--local', 'user.email', 'some-other@test.com']);
                    })
                    .then(() => {
                        return vcsManager.equivalent('clean')
                        .should.eventually.equal(true);
                    });
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
                    const referenceName = "conflictEdit";
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

        describe("Remote", function() {

            const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");
            
            const repoStorePath = path.join(workingPath, "repo-store");
            const referenceStoreName = "compare-vcs-remote-ref";
            let snapshotsPath = path.join(workingPath, 'snapshots');
            let inspectedPath = path.join(workingPath, 'inspected');
    
            let config = archiveCreationConfigExecutor.loadConfigSync(
                path.join(utils.RESOURCES_PATH, 'vcs-compare', 'generate-remote-repo.yaml')
            );

            let refManager;

            before('Initialize paths', function() {
                return fs.emptyDir(workingPath)
                .then(() => {
                    return fs.emptyDir(inspectedPath);
                });
            })

            before('Create ReferenceManager', function() {
                return fs.emptyDir(repoStorePath)
                .then(() => {
                    return zip.extractArchiveTo(
                        path.join(
                            utils.ARCHIVE_RESOURCES_PATH,
                            `compare-vcs-remote-ref-${vcs.STORAGE_TYPE.toString(storageType)}.zip`
                        ),
                        path.join(repoStorePath, referenceStoreName)
                    );
                })
                .then(() => {
                    return vcs.RepoReferenceManager.create(
                        inspectedPath,
                        repoStorePath,
                        referenceStoreName,
                        true,
                        storageType
                    );
                })
                .then(result => {
                    refManager = result;
                });
            })

            before('Create snapshots', function() {
                const assetLoader = new AssetLoader(
                    path.join(utils.RESOURCES_PATH, config.resourcesSubPath)
                );

                assetLoader.setBundlePath();

                const repoSetups =
                    archiveCreationConfigExecutor.createRepoVcsSetupsFromConfig(
                        config
                    );

                let actionExecutor = new ActionExecutor(
                    workingPath,
                    path.relative(workingPath, repoStorePath),
                    assetLoader,
                    repoSetups,
                    storageType
                );

                return fs.emptyDir(snapshotsPath)
                .then(() => {
                    return archiveCreationConfigExecutor.initializeRepos(
                        workingPath,
                        utils.ARCHIVE_RESOURCES_PATH,
                        config
                    );
                })
                .then(() => {

                    let captureSnapshots = Promise.resolve();
                    config.stageNames.forEach(stageName => {
                        captureSnapshots = captureSnapshots.then(() => {
                            return archiveCreationConfigExecutor.executeStage(
                                stageName,
                                config.stageMap,
                                actionExecutor
                            ).then(() => {
                                return fs.copy(
                                    actionExecutor.getRepoFullPaths('remote').fullWorkingPath,
                                    path.join(snapshotsPath, stageName)
                                );
                            })
                            .catch(err => {
                                console.error(`Error on ${stageName}`);
                                console.error(err);
                                return Promise.reject(err);
                            });
                        });
                    });

                    return captureSnapshots;
                });
            });

            after('Clear up', function() {
                return fs.remove(utils.PLAYGROUND_PATH);
            });

            function loadSnapshot(snapshotName) {
                return fs.copy(
                    path.join(snapshotsPath, snapshotName),
                    inspectedPath
                );
            }

            describe('Equal', function() {

                beforeEach('Clean inspected path', function() {
                    return fs.emptyDir(inspectedPath);
                });

                config.stageNames.forEach(stageName => {
                    it(`${stageName}`, function() {
                        return loadSnapshot(stageName)
                        .then(() => {
                            return refManager.equivalent(stageName);
                        })
                        .should.eventually.be.true;
                    });
                });
            });

            describe('Different', function() {

                config.stageNames.forEach(stageName => {

                    describe(`== ${stageName} ==`, function() {

                        before('Load snapshot', function() {
                            return fs.emptyDir(inspectedPath)
                            .then(() => {
                                return loadSnapshot(stageName);
                            });
                        });

                        config.stageNames.forEach(otherStageName => {
                            if (stageName !== otherStageName) {
                                it(`${stageName} v.s. ${otherStageName}`, function() {
                                    return refManager.equivalent(otherStageName)
                                    .should.eventually.be.false;
                                });
                            }
                        });
                    });
                });

            });
        });

        describe('Config', function() {

            describe('Remote URL', function() {

                let testingRepo;
                let vcsManager;

                const workingPath = path.join(utils.PLAYGROUND_PATH, 'vcs-compare-config');
                const testingRepoPath = path.join(workingPath, 'testing-repo');
                const repoStorePath = path.join(workingPath, 'repo-store');
                const referenceStoreName = 'test-ref';
                const remoteName = 'origin';
                const remoteRefAbsolutePath = path.join(workingPath, 'remote');

                const referenceName = 'ref-for-test';

                before('Create reference', function() {

                    this.timeout(6000);

                    const referenceRepoPath = path.join(workingPath, 'ref-repo');

                    return fs.emptyDir(workingPath)
                    .then(() => fs.emptyDir(testingRepoPath))
                    .then(() => fs.emptyDir(repoStorePath))
                    .then(() => fs.emptyDir(referenceRepoPath))
                    .then(() => {
                        let repo = simpleGit(referenceRepoPath);
                        return repo.init(false)
                        .then(() => repo.raw(['remote', 'add', remoteName, remoteRefAbsolutePath]));
                    })
                    .then(() => {
                        return vcs.RepoReferenceMaker.create(
                            referenceRepoPath,
                            repoStorePath,
                            referenceStoreName,
                            false,
                            storageType
                        )
                        .then(vcsReferenceMaker => {
                            return vcsReferenceMaker.save(referenceName);
                        });
                    })
                    .then(() => {

                    })
                    .then(() => {
                        return fs.remove(referenceRepoPath); // clean up
                    });
                });

                beforeEach('Initialize testing folder', function() {
                    return fs.emptyDir(testingRepoPath)
                    .then(() => {
                        return vcs.RepoReferenceManager.create(
                            testingRepoPath,
                            repoStorePath,
                            referenceStoreName,
                            false,
                            storageType
                        );
                    })
                    .then(result => {
                        vcsManager = result;
                    })
                    .then(() => {
                        testingRepo = simpleGit(testingRepoPath);
                        return testingRepo.init(false);
                    });
                })

                after('Clean up', function() {
                    return fs.remove(workingPath);
                })

                describe('Equal', function() {

                    it('setting absolute', function() {
                        return testingRepo.raw(['remote', 'add', remoteName, remoteRefAbsolutePath])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(true);
                        });
                    });

                    it('setting relative', function() {
                        return testingRepo.raw(['remote', 'add', remoteName, path.relative(testingRepoPath, remoteRefAbsolutePath)])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(true);
                        })
                    });

                });

                describe('Different', function() {

                    it('not set', function() {
                        return vcsManager.equivalent(referenceName)
                        .should.eventually.equal(false);
                    });

                    it('empty', function() {
                        return testingRepo.raw(['remote', 'add', remoteName, ''])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(false);
                        });
                    });

                    it('wrong remote name', function() {
                        return testingRepo.raw(['remote', 'add', `${remoteName}2`, remoteRefAbsolutePath])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(false);                           
                        })
                    })

                    it('set valid absolute path', function() {
                        return testingRepo.raw(['remote', 'add', remoteName, repoStorePath])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(false);
                        });
                    });

                    it('set valid relative path', function() {
                        return testingRepo.raw(['remote', 'add', remoteName, path.relative(testingRepoPath, repoStorePath)])
                        .then(() => {
                            return vcsManager.equivalent(referenceName)
                            .should.eventually.equal(false);
                        });
                    });

                });
            })
        });
    });

}

