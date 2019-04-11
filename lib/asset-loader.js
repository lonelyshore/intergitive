"use strict";

const fs = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");
const assert = require("assert");

const indexCache = Symbol("indexCache");
const loadIndex = Symbol("loadIndex");
const retrieveValueFromIndex = Symbol("retrieveValueFromIndex");

let isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

class AssetIndex {
    constructor(obj) {
        assert("asset_index" in obj);

        let indexBody = obj.asset_index;

        assert(indexBody !== undefined && indexBody !== null);

        // mode
        assert("mode" in indexBody);
        let mode = indexBody.mode;

        assert(isString(mode) && (mode === "infile" || mode === "ondisk"));
        this.mode = mode;


        // assets
        assert("assets" in indexBody);
        let assets = indexBody.assets;

        assert(assets instanceof Object);
        this.assets = assets === null ? {} : assets;

        
        // fallbacks
        if ("fallbacks" in indexBody) {
            let fallbacksSource = indexBody.fallbacks;
            assert(fallbacksSource instanceof Object);

            let fallbacks = {};
            if ("default" in fallbacksSource) {
                let defaultSetting = fallbacksSource.default;
                assert(defaultSetting instanceof Object);
                assert("target_path" in defaultSetting);
                assert(isString(defaultSetting.target_path));
                assert("keys" in defaultSetting);

                let keys = defaultSetting.keys;
                assert(Array.isArray(keys));
                keys.forEach(element => assert(isString(element)));

                fallbacks.default = defaultSetting;
            }
            else {
                fallbacks.default = null;
            }

            if ("redirects" in fallbacksSource) {
                let redirects = fallbacksSource.redirects;
                assert(redirects instanceof Object);
                fallbacks.redirects = redirects;
            }
            else {
                fallbacks.redirects = {};
            }

            this.fallbacks = fallbacks;
        }
        else {
            this.fallbacks = {
                default: null,
                redirects: {}
            };
        }
    }
}

class AssetLoader {
    constructor(rootPath) {
        assert(path.isAbsolute(rootPath));

        this.rootPath = rootPath;
        this[indexCache] = {};
    }

    /**
     * @param {...string} pathElements
     */
    setBundlePath(...pathElements) {
        this.bundlePathElements = pathElements;
        this.bundlePath = path.join(...pathElements);
    }

    /**
     * 
     * @param {string} assetPath 
     * @return {Promise<any>}
     */
    getFullAssetPath(assetPath) {
        return this[retrieveValueFromIndex](assetPath)
        .then(indexedValue => {
            return path.join(this.rootPath, this.bundlePath, indexedValue);
        });
    }

    /**
     * 
     * @param {string} assetPath 
     * @returns {Promise<string>}
     */
    loadInfileAsset(assetPath) {
        return this[retrieveValueFromIndex](assetPath);
    }

    /**
     * @returns {Promise<AssetIndex>}
     */
    [loadIndex](containerPath) {
        let containerFullPath = path.join(
            this.rootPath,
            this.bundlePath,
            containerPath
        );

        let parsed = path.parse(containerFullPath);
        let indexName = parsed.name + "-index.yaml";
        let indexPath = path.join(parsed.dir, indexName);

        assert(fs.existsSync(indexPath));

        return fs.readFile(indexPath)
            .then(content => yaml.safeLoad(content))
            .then(obj => new AssetIndex(obj));
    }

    /**
     * 
     * @param {string} assetPath 
     * @returns {string}
     */
    [retrieveValueFromIndex](assetPath) {
        let parsed = path.parse(assetPath);
        let key = parsed.base;
        let container = parsed.dir;

        let index = this[indexCache][container];
        let readIndex;
        if (index === undefined) {
            readIndex = () => {
                    return this[loadIndex](container)
                    .then(indexResult => {
                        index = indexResult;
                        this[indexCache][container] = index;
                        return indexResult;
                    })
                };
        }
        else {
            readIndex = () => Promise.resolve(index);
        }

        return readIndex()
            .then(indexResult => {
                return indexResult.assets[key];
            });
    }
}

module.exports.AssetLoader = AssetLoader;