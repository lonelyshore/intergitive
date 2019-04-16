"use strict";

const actionConf = require("./config-action");
const stepConf = require("./config-step");
const ActionEvaluator = require("./action-evaluator").ActionEvaluator;
const Level = require("./config-level").Level;
const schema = require("./config-schema");
const yaml = require("js-yaml");
const fs = require("fs-extra");
const vcs = require("./repo-vcs");

/**
 * 
 * @param {string} configPath 
 */
const loadConfig = function(configPath) {
    return fs.readFile(configPath)
    .then(content => {
        return yaml.safeLoad(content, {
            schema: schema.CONFIG_SCHEMA
        });
    });
}

const loadReferenceMakerMapping = function(repoVcsSetups, storePath) {

    let referenceMakerMapping = {};

    let loadReferenceMakers =
        Object.keys(repoVcsSetups).map(key => {
            let setup = repoVcsSetups[key];
            return vcs.RepoReferenceMaker.create(
                setup.workingPath,
                storePath,
                setup.referenceStoreName
            )
            .then(maker => {
                referenceMakerMapping[key] = maker;
            });
        });

    return Promise.all(loadReferenceMakers).then(() => {
        return referenceMakerMapping;
    });
}

/**
 * 
 * @param {Level} level
 * @param {ActionEvaluator} actionEvaluator
 */
const loadActionPromisesFromLevel = function(levelName, level, actionEvaluator, storePath) {

    let referenceMakerMapping;
    let promises = loadReferenceMakerMapping(level.repoVcsSetups, storePath)
    .then(result => {
        referenceMakerMapping = result;
    });

    level.steps.forEach((step, stepIndex) => {
        if (step instanceof stepConf.ActionStep) {
            step.actions.forEach(action => {
                promises = promises.then(() => {
                    return action.evaluate(actionEvaluator);
                });
            });
        }
        else if (step instanceof stepConf.VerifyStep) {
            promises = promises.then(() => {
                let referenceMaker = referenceMakerMapping[step.repoSetupName];
                return referenceMaker.save(`${levelName}-${stepIndex}`);
            });
        }
    })
}

/**
 * 
 * @param {string} configPath 
 */
const run = function(configPath) {
    
}
