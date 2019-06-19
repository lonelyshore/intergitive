'use strict';

const path = require('path');
const paths = require('../paths');
const AssetLoader = require('./asset-loader').AssetLoader;
const fs = require('fs-extra');
const yaml = require('js-yaml');
const schema = require('./level-config-schema');
const assetLoader = new AssetLoader(paths.RESOURCES_PATH);
assetLoader.setBundlePath(...paths.BUNDLE_PATH);

let store = {
    state: {
        stepsReady: false,
        terms: {
            elaborate: ""
        },
        renderSteps: {},
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
    processAssetIdInText(text) {
        const matchAssetId = /\$?{{[\w\d:\/-]*}}/g;
        let replacementMap = {};

        return Promise.resolve()
        .then(() => {
            let setReplacementMap = [];
            text.match(matchAssetId).forEach(matched => {
                if (matched.startsWith('$')) {
                    setReplacementMap.push(
                        assetLoader.loadInfileAsset(matched.slice(3, matched.length - 2))
                        .then(content => {
                            replacementMap[matched] = content;
                        })
                    )
                }
                else {
                    setReplacementMap.push(
                        assetLoader.loadInfileAsset(matched.slice(2, matched.length - 2))
                        .then(content => {
                            replacementMap[matched] = path.join(paths.STATIC_PATH, content);
                        })
                    )
                }
            })

            return Promise.all(setReplacementMap);
        })
        .then(() => {
            return text.replace(matchAssetId, (matched) => {
                return replacementMap[matched];
            });
        });
    },
    loadSteps(levelName) {
        this.state.stepsReady = false;

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
                        meta: {}
                    };

                    renderingSteps[index] = renderingStep;
                }
            });

            this.state.renderSteps = renderingSteps;
            this.state.stepsReady = true;
        })
    }
}

exports = module.exports = store;