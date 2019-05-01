"use strict";

const path = require("path");
const fs = require("fs-extra");
const utils = require("./test-utils");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const zip = require("../../lib/simple-archive");
const vcs = require("../../lib/repo-vcs");

chai.use(chaiAsPromised);
chai.should();

describe.skip("VCS Compare", function() {
    describe("Local", function() {

        const playgroundPath = utils.PLAYGROUND_PATH;

        const checkedBasePath = path.join(playgroundPath, "checked");
        const checkedRepoPath = path.join(checkedBasePath, "compare-test-local");
        const referenceStorePath = path.join(playgroundPath, "repo-store");
        const referenceStoreName = "compare-test-local";

        let checkedRepo;
        let vcsManager;

        before(function() {
            

            const archivePath = path.join(utils.RESOURCES_PATH, "repo-archive");
            const referenceArchivePath = path.join(archivePath, "compare-test-local-ref.zip");
            const checkedArchivePath = path.join(archivePath, "compare-test-local-checked.zip");
            
            return fs.ensureDir(playgroundPath)
            .then(() => {
                return zip.extractArchiveTo(referenceArchivePath, referenceStorePath);
            })
            .then(() => {
                return zip.extractArchiveTo(checkedArchivePath, checkedBasePath);
            })
            .then(() => {
                return vcs.RepoReferenceManager.create(checkedRepoPath, referenceStorePath, referenceStoreName)
                .then((manager) => {
                    vcsManager = manager;
                });
            });
        });

        describe("Equal", function() {
            it("clean stage and working directory", function() {
                const referenceName = "clean";

            });
    
            it("dirty stage", function() {
                const referenceName = "dirty-stage";

            });
    
            it("dirty working directory", function() {
                const referenceName = "dirty-directory";
                
            });
    
            it("merged", function() {
                const referenceName = "merged";

            });
    
            it("merging conflict", function() {
                const referenceName = "conflict";

            });
    
            it("merging conflict editted", function() {
                const referenceName = "conflict-edit";
                
            });

            it("merging conflict staged", function() {
                const referenceName = "conflict-staged";

            });
    
            it("merging conflict resolved", function() {
                const referenceName = "conflict-resolved";
                
            });
    
            it("detached head", function() {
                const referenceName = "detached";

            });
        });
    
        describe("Different", function() {
    
        });
    });
});