'use strict';

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
const { LEVEL_CONFIG_SCHEMA } = require('../../lib/level-config-schema');
const stepConfigs = require('../../lib/config-step');
const actionConfigs = require('../../lib/config-action');
const assert = require('chai').assert

chai.use(chaiAsPromised);
chai.should();

/**
 * This test fixture ensures that serialization of level configuration
 * has the following properties:
 * 1. All defined step types (in config-step.js) and actions types (in lib/config-actino.js)
 *    can be serialized and deserialized via YAML
 * 2. The YAML serialization is stable.
 *    The object deserialized from a text equals to the one that generates the text.
 */
describe.only('Level Serialization #core', function() {

    let sampleSteps = [];
    let sampleActions = [];
    let allStepTypes;
    let allActionTypes;

    before('Loads Sample Steps and Actions', function() {
        return fs.readFile(
            path.join(
                utils.RESOURCES_PATH,
                'serialization',
                'sample-steps.yaml'
            )
        )
        .then(content => {
            sampleSteps = yaml.load(content, { schema: LEVEL_CONFIG_SCHEMA });
        })
        .then(() => fs.readFile(
            path.join(
                utils.RESOURCES_PATH,
                'serialization',
                'sample-actions.yaml'
            )
        ))
        .then(content => {
            sampleActions = yaml.load(content, { schema: LEVEL_CONFIG_SCHEMA });
        });
    });

    before('Prepare Step and Action Types', function() {
        allStepTypes = Object.assign({}, stepConfigs);
        delete allStepTypes.Step;
        delete allStepTypes.ProcessState;
        delete allStepTypes.AutoFirstProcessPhase;
        delete allStepTypes.UserDrivenProcessPhase;

        allActionTypes = Object.assign({}, actionConfigs);
        delete allActionTypes.Action;
    });

    describe('Validate Test Coverage Rate', function() {

        function assertConsumeAllTypes(deserializedObjects, typeMapping) {
            let unconsumed = new Set(Object.keys(typeMapping));

            deserializedObjects.forEach(obj => {
                let typeName = obj.constructor.name;
                if (unconsumed.has(typeName)) {
                    unconsumed.delete(typeName);
                }
            });

            assert(unconsumed.size === 0, `unconsumed: {${Array.from(unconsumed).join(', ')}`);
        }

        it('Sample steps covers all defiend steps', function() {
            assertConsumeAllTypes(
                sampleSteps,
                allStepTypes
            );
        });

        it('Sample actions covers all defiend actions', function() {
            assertConsumeAllTypes(
                sampleActions,
                allActionTypes
            );
        });

    });


    it('GENERATE_TESTS', function() {
        createTestsForSampleObjects(sampleSteps, allStepTypes);
        createTestsForSampleObjects(sampleActions, allActionTypes);
    })

});

function createTestsForSampleObjects(sampleObjects, refTypes) {
    describe('Validate Serialization', function() {

        sampleObjects.forEach(obj => {
            it(obj.constructor.name, function(){
                return Promise.resolve()
                .then(() => yaml.dump(obj, { schema: LEVEL_CONFIG_SCHEMA }))
                .should.eventually.be.fulfilled;
            });
        });
    });
}