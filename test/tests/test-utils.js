"use strict"

const path = require("path");

const resourcesPath = path.resolve(__dirname, "../resources");

module.exports.PLAYGROUND_PATH = path.resolve(__dirname, "../playground");
module.exports.RESOURCES_PATH = resourcesPath;
module.exports.ARCHIVE_RESOURCES_PATH = path.join(resourcesPath, "repo-archive");
module.exports.notImplemented = function() { throw new Error("fail"); }