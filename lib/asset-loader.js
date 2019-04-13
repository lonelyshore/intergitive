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

let calculateRedirect = function(currentBundleTokens, redirectBundleTokens) {
    let mergedTokens = currentBundleTokens.map((element, index) => {
        return redirectBundleTokens[index] !== null && redirectBundleTokens[index] !== "" ? redirectBundleTokens[index] : element;
    });

    return mergedTokens.join(path.sep);
}

class AssetIndex {
    /**
     * 
     * @param {Object} obj 
     * @param {string} bundlePath 
     */
    constructor(obj, bundlePath) {
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

        assert(assets instanceof Object && !Array.isArray(assets));
        this.assets = assets === null ? {} : assets;

        
        // fallbacks
        let fallbacks = {};
        if ("fallbacks" in indexBody) {
            let bundleTokens = bundlePath.split(path.sep).filter(element => {
                return element !== null && element !== "";
            });

            let fallbacksSource = indexBody.fallbacks;
            assert(fallbacksSource instanceof Object);

            if ("default" in fallbacksSource) {
                let defaultSetting = fallbacksSource.default;
                assert(defaultSetting instanceof Object);
                assert("path_replacement" in defaultSetting);
                assert(Array.isArray(defaultSetting.path_replacement));
                assert(defaultSetting.path_replacement.length === bundleTokens.length);
                defaultSetting.path_replacement.forEach(element => {
                    assert(isString(element));
                });
                let defaultRedirect = calculateRedirect(bundleTokens, defaultSetting.path_replacement);

                assert("keys" in defaultSetting);

                let keys = defaultSetting.keys;
                assert(Array.isArray(keys));
                keys.forEach(element => { 
                    assert(isString(element));
                    fallbacks[element] = defaultRedirect;
                });
            }

            if ("redirects" in fallbacksSource) {
                let redirects = fallbacksSource.redirects;
                assert(redirects instanceof Object && !Array.isArray(redirects));
                Object.keys(redirects).forEach(key => {
                    let value = redirects[key];
                    assert(Array.isArray(value));
                    assert(value.length === bundleTokens.length);
                    value.forEach(element => {
                        assert(isString(element));
                    });

                    let redirect = calculateRedirect(
                        bundleTokens,
                        value
                    );

                    fallbacks[key] = redirect;
                });
            }
        }

        this.fallbacks = fallbacks;
    }
}

class NotFoundError extends Error {
    constructor(sourceBundlePath, finalBundlePath, assetName) {
        super(`Failed to find ${assetName}, given the beginning source bundle path ${sourceBundlePath} and last valid bundle path ${finalBundlePath}`);

        this.sourceBundlePath = sourceBundlePath;
        this.finalBundlePath = finalBundlePath;
        this.assetName = assetName;
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
        return this[retrieveValueFromIndex](this.bundlePath, assetPath)
        .then(indexedResult => {
            return indexedResult === null
                ? null
                : path.join(this.rootPath, indexedResult.assetBundlePath, indexedResult.assetContent);
        });
    }

    /**
     * 
     * @param {string} assetPath 
     * @returns {Promise<string>}
     */
    loadInfileAsset(assetPath) {
        return this[retrieveValueFromIndex](this.bundlePath, assetPath)
        .then(indexedResult => {
            return indexedResult === null
                ? new NotFoundError("", "", "")
                : indexedResult.assetContent;
        })
    }

    /**
     * @param {string} containerPath
     * @param {string} bundlePath
     * @returns {Promise<AssetIndex>}
     */
    [loadIndex](containerPath, bundlePath) {
        let containerFullPath = path.join(
            this.rootPath,
            containerPath
        );

        let parsed = path.parse(containerFullPath);
        let indexName = parsed.name + "-index.yaml";
        let indexPath = path.join(parsed.dir, indexName);

        assert(fs.existsSync(indexPath));

        return fs.readFile(indexPath)
            .then(content => yaml.safeLoad(content))
            .then(obj => new AssetIndex(obj, bundlePath));
    }

    /**
     * 
     * @param {string} bundlePath
     * @param {string} assetPath
     * @returns {string} 
     */
    [retrieveValueFromIndex](bundlePath, assetPath) {
        let parsed = path.parse(assetPath);
        let key = parsed.base;
        let container = path.join(bundlePath, parsed.dir);

        let index = this[indexCache][container];
        let readIndex;
        if (index === undefined) {
            readIndex = () => {
                    return this[loadIndex](container, bundlePath)
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
                if (key in indexResult.assets) {
                    return { assetContent: indexResult.assets[key], assetBundlePath: bundlePath };
                }
                else if (key in indexResult.fallbacks) {
                    let newBundlePath = indexResult.fallbacks[key];
                    return this[retrieveValueFromIndex](newBundlePath, assetPath);
                }
                else {
                    return null;
                }
            });
    }
}

module.exports.AssetLoader = AssetLoader;
module.exports.NotFoundError = NotFoundError;