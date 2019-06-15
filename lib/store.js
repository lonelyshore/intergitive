'use strict';

const paths = require('../paths');
const AssetLoader = require('./asset-loader').AssetLoader;
const fs = require('fs-extra');
const assetLoader = new AssetLoader(paths.RESOURCES_PATH);
assetLoader.setBundlePath(paths.BUNDLE_PATH);

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
    }
}

exports = module.exports = store;