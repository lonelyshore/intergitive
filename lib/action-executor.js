"use strict";

const fs = require("fs-extra");
const path = require("path");
const AssetLoader = require("./asset-loader").AssetLoader;


class ActionExecutor {
    /**
     * 
     * @param {string} fileSystemBaseFolder 
     * @param {AssetLoader} assetLoader 
     */
    constructor(fileSystemBaseFolder, assetLoader) {
        this.fileSystemBaseFolder = fileSystemBaseFolder;
        this.assetLoader = assetLoader;
    }

    /**
     * 
     * @param {Array<string>} sourceKeyIds 
     * @param {Array<string>} destinationPaths 
     */
    executeWriteFile(sourceKeyIds, destinationPaths) {
        
        if (sourceKeyIds.length !== destinationPaths.length) {
            return new Promise.reject(
                new Error(
                    `sourceKeyIds should have a length (${sourceKeyIds.length}) equals to the one of destinationPaths (${destinationPaths.length})`));
        }

        let writes = [];
        
        sourceKeyIds.forEach((keyId, index) => {
            writes.push(
                this.assetLoader.getFullAssetPath(keyId)
                .then(sourcePath => {
                    return fs.copy(sourcePath, path.join(this.fileSystemBaseFolder, destinationPaths[index]));
                })
            );
        });

        return Promise.all(writes);
    }

    executeStaging(repoSetupName, pathspecs) {
        return Promise.reject("Not implelemnted");
    }
}

module.exports.ActionExecutor = ActionExecutor;