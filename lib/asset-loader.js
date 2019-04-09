"use strict";

const fs = require("fs-extra");
const path = require("path");

class AssetLoader {
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.indexCache = {};
    }

    /**
     * @param {...string} pathElements
     */
    setBundlePath(...pathElements) {
        this.bundlePathElements = pathElements;
    }

    /**
     * 
     * @param {string} assetPath 
     * @return {Promise<any>}
     */
    getFullAssetPath(assetPath) {
        let parsed = path.parse(assetPath);
        let key = parsed.base;
        let container = parsed.dir;


    }

    /**
     * 
     * @param {string} assetPath 
     * @returns {Promise<string>}
     */
    loadInfileAsset(assetPath) {

    }
}

module.exports.AssetLoader = AssetLoader;