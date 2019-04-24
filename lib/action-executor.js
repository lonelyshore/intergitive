"use strict";

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

    executeWriteFile(sourceKeyName, destinationPaths) {
        return Promise.reject(Error("Not Implemented"));
    }
}

module.exports.ActionExecutor = ActionExecutor;