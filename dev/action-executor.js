"use strict";

const ActionExecutor = require("../lib/action-executor").ActionExecutor;

class DevActionExecutor extends ActionExecutor {
    constructor(fileSystemBaseFolder, assetLoader, repoSetups) {
        super(fileSystemBaseFolder, assetLoader, repoSetups);
    }
}

module.exports.DevActionExecutor = DevActionExecutor;