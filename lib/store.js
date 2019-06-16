'use strict';

const paths = require('../paths');
const AssetLoader = require('./asset-loader').AssetLoader;
const fs = require('fs-extra');
const yaml = require('js-yaml');
const schema = require('./level-config-schema');
const assetLoader = new AssetLoader(paths.RESOURCES_PATH);
assetLoader.setBundlePath(...paths.BUNDLE_PATH);

let store = {
    state: {
        terms: {
            elaborate: ""
        },
        steps: {},
    },
    loadTerms() {
        return assetLoader.loadInfileAsset('render/elaborate')
        .then(term => {
            this.state.terms.elaborate = term;
        });
    },
    loadText(assetId) {
        return assetLoader.getFullAssetPath(assetId)
        .then(assetPath => {
            return fs.readFile(assetPath);
        });
    },
    loadSteps(levelName) {
        return assetLoader.getFullAssetPath(`levels/${levelName}`)
        .then(assetPath => {
            console.log(`loading ${levelName} text`);
            return fs.readFile(assetPath);
        })
        .then(text => {
            console.log(`loading ${levelName} json`);
            return yaml.safeLoad(text, { schema: schema.LEVEL_CONFIG_SCHEMA });
        })
        .then(config => {
            console.log(`loading ${levelName} steps`);
            let renderingSteps = {};
            config.steps.forEach((step, index) => {
                if (step.componentType) {
                    let renderingStep = {
                        step: step,
                        componentType: step.componentType
                    };

                    renderingSteps[index] = renderingStep;
                }
            })
        })
    }
}

exports = module.exports = store;