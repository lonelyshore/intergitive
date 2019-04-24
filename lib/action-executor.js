"use strict";

const AssetLoader = require("./asset-loader").AssetLoader;
const fs = require("fs-extra");

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
                    return fs.copy(sourcePath, destinationPaths[index]);
                })
            );
        });

        return Promise.all(writes);
    }
}

module.exports.ActionExecutor = ActionExecutor;