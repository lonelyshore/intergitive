"use strict";

const fs = require("fs-extra");
const path = require("path");
const yaml = require("js-yaml");
const assert = require("assert");

const indexCache = Symbol("indexCache");
const loadIndex = Symbol("loadIndex");
const retrieveValueFromIndex = Symbol("retrieveValueFromIndex");
const bundlePathWalked = Symbol("bundlePathWalked");
const handleError = Symbol("HandleError");

let isString = function(obj) {
    return typeof obj === 'string' || obj instanceof String;
}

let calculateRedirect = function(currentBundleTokens, redirectBundleTokens) {
    let mergedTokens = currentBundleTokens.map((element, index) => {
        return redirectBundleTokens[index] !== null && redirectBundleTokens[index] !== "" ? redirectBundleTokens[index] : element;
    });

    return mergedTokens.join(path.sep);
}

let parseAssetPath = function(assetPath) {
    let parsed = path.parse(assetPath);
    return {
        get assetName() {
            return parsed.base;
        },

        get containerSubPath() {
            return parsed.dir;
        }
    };
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
    constructor(startingContainerPath, finalContainerPath, assetName) {
        super(`Failed to find ${assetName}, given the beginning source bundle path ${startingContainerPath} and last valid bundle path ${finalContainerPath}`);

        this.startingContainerPath = startingContainerPath;
        this.finalContainerPath = finalContainerPath;
        this.assetName = assetName;
    }
}

class CyclicFallbackError extends Error {
    constructor(startingContainerPath, assetName) {
        super(`Cyclic fallback detected for loading ${assetName} from ${startingContainerPath}`);

        this.startingContainerPath = startingContainerPath;
        this.assetName = assetName;
    }
}

class InternalNotFoundError extends Error {
    constructor(finalBundlePath){
        super("NotFound");
        this.finalBundlePath = finalBundlePath;
    }
}

class InternalCyclicFallbackError extends Error {
    constructor() {
        super("CyclicFallback");
    }
}

class AssetLoader {
    constructor(rootPath) {
        assert(path.isAbsolute(rootPath));

        this.rootPath = rootPath;
        this[indexCache] = {};
        this[bundlePathWalked] = {};
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
        let parsedPath = parseAssetPath(assetPath);
        return this[retrieveValueFromIndex](this.bundlePath, parsedPath)
        .then(indexedResult => {
            return path.join(this.rootPath, indexedResult.assetBundlePath, indexedResult.assetContent);
        })
        .catch(err => {
            this[handleError](err, parsedPath);
        });
    }

    /**
     * 
     * @param {string} assetPath 
     * @returns {Promise<string>}
     */
    loadInfileAsset(assetPath) {
        let parsedPath = parseAssetPath(assetPath);
        this[bundlePathWalked] = {};

        return this[retrieveValueFromIndex](this.bundlePath, parsedPath)
        .then(indexedResult => {
            return indexedResult.assetContent;
        })
        .catch(err => {
            this[handleError](err, parsedPath);
        });
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

        if (fs.existsSync(indexPath)) {
            return fs.readFile(indexPath)
            .then(content => yaml.safeLoad(content))
            .then(obj => new AssetIndex(obj, bundlePath));
        }
        else {
            return Promise.resolve(null);
        }


    }

    /**
     * 
     * @param {string} bundlePath
     * @param {Object} assetPath
     * @returns {string} 
     */
    [retrieveValueFromIndex](bundlePath, parsedAssetPath) {

        let containerPath = path.join(bundlePath, parsedAssetPath.containerSubPath);

        let index = this[indexCache][containerPath];
        let readIndex;
        if (index === undefined) {
            readIndex = () => {
                    return this[loadIndex](containerPath, bundlePath)
                    .then(indexResult => {
                        index = indexResult;
                        this[indexCache][containerPath] = index;
                        return indexResult;
                    })
                };
        }
        else {
            readIndex = () => Promise.resolve(index);
        }

        let assetName = parsedAssetPath.assetName;
        return readIndex()
            .then(indexResult => {
                if (indexResult === null ) { // Container index not found
                    return {assetContent: null, assetBundlePath: bundlePath };
                }
                else if (assetName in indexResult.assets) {
                    return { assetContent: indexResult.assets[assetName], assetBundlePath: bundlePath };
                }
                else if (assetName in indexResult.fallbacks) {
                    let newBundlePath = indexResult.fallbacks[assetName];
                    if (newBundlePath in this[bundlePathWalked]) {
                        throw new InternalCyclicFallbackError();
                    }
                    else {
                        return this[retrieveValueFromIndex](newBundlePath, parsedAssetPath);
                    }
                }
                else {
                    throw new InternalNotFoundError(bundlePath);
                }
            });
    }

    [handleError](err, parsedPath) {
        if (err instanceof InternalNotFoundError) {
            throw new NotFoundError(
                path.join(this.bundlePath, parsedPath.containerSubPath),
                path.join(err.finalBundlePath, parsedPath.containerSubPath),
                parsedPath.assetName                    
            );
        }
        else if (err instanceof InternalCyclicFallbackError) {
            throw new CyclicFallbackError(path.join(this.bundlePath, parsedPath.containerSubPath));
        }
        else {
            throw err;
        }
    }
}

module.exports.AssetLoader = AssetLoader;
module.exports.NotFoundError = NotFoundError;
module.exports.CyclicFallbackError = CyclicFallbackError;