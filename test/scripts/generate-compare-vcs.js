"use strict";

const fs = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");
const zip = require("../../lib/simple-archive");

const ACTION_SCHEMAS = require("../../dev/config-schema").LEVEL_CONFIG_SCHEMA;
const ActionExecutor = require("../../dev/action-executor").DevActionExecutor;
const Action = require("../../lib/config-action").Action;
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const RepoSetup = require("../../lib/config-level").RepoVcsSetup;
const RefMaker = require("../../lib/repo-vcs").RepoReferenceMaker;

const resoruceBasePath = path.resolve(__dirname, "../resources");
const assetStorePath = path.join(resoruceBasePath, "vcs-compare", "assets");
const yamlSubPath = path.join("vcs-compare", "generate.yaml");

const workingPath = path.resolve(__dirname, "../playground/generate-vcs-repo");
const sourceRepoPath = path.join(workingPath, "repo");
const refStorePath = path.join(workingPath, "repo-store");
const refName = "vcs-compare-test";

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

const assetLoader = new AssetLoader(assetStorePath);
assetLoader.setBundlePath();

const repoSetups = {
    compare: new RepoSetup(
        sourceRepoPath,
        undefined,
        undefined
    )
};

const actionExecutor = new ActionExecutor(
    workingPath,
    assetLoader,
    repoSetups
);

let initializeRepo = () => {
    return fs.emptyDir(sourceRepoPath)
    .then(() => {
        return zip.extractArchiveTo(path.join(resoruceBasePath, "repo-archive", "compare-vcs.zip"), workingPath);
    });
}

let refMaker;

Promise.resolve()
.then(() => {
    return fs.emptyDir(workingPath)
    .then(() => {
        return fs.emptyDir(refStorePath);
    })
    .then(initializeRepo);
})
.then(() => {
    return RefMaker.create(sourceRepoPath, refStorePath, refName)
    .then(result => {
        refMaker = result;
    });
})
.then(() => {
    return fs.readFile(path.join(resoruceBasePath, yamlSubPath))
    .then(content => {
        return yaml.load(content, { schema: ACTION_SCHEMAS });
    });
})
.then(config => {
    let actionMap = {};
    config.actions.forEach(action => {
        actionMap[action.name] = action.contents;
    });

    let executions = Promise.resolve();

    config.actions.forEach(action => {
        
        executions = executions.then(initializeRepo);

        let contents = action.contents;
        if (contents.length !== 0 && ("replay" in contents[0])) {
            let replayContents = [];
            contents[0]["replay"].forEach(replayName => {
                replayContents = replayContents.concat(actionMap[replayName]);
            });

            executions = executions.then(() => executeContents(replayContents, actionExecutor));
        }

        executions = executions.then(() => executeContents(contents, actionExecutor));

        executions = executions.then(() => {
            return refMaker.save(action.name)
            .catch(err => {
                console.error(`[save${action.name}] ${err.message}`);
                throw err;
            });
        });
    })

    return executions;
});
