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
        })
    });
});