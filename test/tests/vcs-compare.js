"use strict";

const path = require("path");
const fs = require("fs-extra");
const yaml = require("js-yaml");
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

describe("VCS Compare", function() {
    describe("Local", function() {

        const workingPath = path.join(utils.PLAYGROUND_PATH, "compare-vcs");

        const checkedRepoPath = path.join(workingPath, "repo");
        const referenceStorePath = path.join(workingPath, "repo-store");
        const referenceStoreName = "compare-vcs-local-ref";

        const archivePath = path.join(utils.RESOURCES_PATH, "repo-archive");
        const referenceArchivePath = path.join(archivePath, "compare-vcs-local-ref.zip");
        const checkedArchivePath = path.join(archivePath, "compare-vcs.zip");

        let checkedRepo;
        let vcsManager;
        let stageMap = {};
        let actionExecutor;

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
                        stageMap[action.name] = action.contents.filter(item => {
                            return item instanceof Action;
                        });
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
            return fs.emptyDir(checkedRepoPath)
            .then(() => zip.extractArchiveTo(checkedArchivePath, workingPath));
        });

        describe("Equal", function() {
            it("clean stage and working directory", function() {
                const referenceName = "clean";
                utils.notImplemented();
            });
    
            it("dirty stage", function() {
                const referenceName = "dirty-stage";
                utils.notImplemented();
            });
    
            it("dirty working directory", function() {
                const referenceName = "dirty-directory";
                utils.notImplemented();                
            });
    
            it("merged", function() {
                const referenceName = "merged";
                utils.notImplemented();

            });
    
            it("merging conflict", function() {
                const referenceName = "conflict";
                utils.notImplemented();
            });
    
            it("merging conflict editted", function() {
                const referenceName = "conflict-edit";
                utils.notImplemented();
            });

            it("merging conflict staged", function() {
                const referenceName = "conflict-staged";
                utils.notImplemented();
            });
    
            it("merging conflict resolved", function() {
                const referenceName = "conflict-resolved";
                utils.notImplemented();                
            });
    
            it("detached head", function() {
                const referenceName = "detached";
                utils.notImplemented();
            });
        });
    
        describe("Different", function() {
    
        });
    });
});