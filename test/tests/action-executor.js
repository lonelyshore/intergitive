"use strict";

"use strict";

const path = require("path");
const fs = require("fs-extra");
const utils = require("./test-utils");
const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const ActionExecutor = require("../../lib/action-executor").ActionExecutor;
const actionTypes = require("../../lib/config-action");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

const fail = function() {
    throw new Error("fail");
}

describe("Action Executor", function() {

    let actionExecutor;

    before(function() {
        let assetLoader = new AssetLoader(path.join(utils.RESOURCES_PATH, "action-executor/resources"));
        assetLoader.setBundlePath();
        actionExecutor = new ActionExecutor(utils.PLAYGROUND_PATH, assetLoader);
    })

    describe("File Operations", function() {
            
        beforeEach("Initialize Playground", function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        });

        afterEach("Remove Playground", function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        describe("Write File", function() {

            /**
             * 
             * @param {string} str
             * @returns {string} 
             */
            const reverseString = function(str) {
                return str.split("").reverse().join("");
            }

            const initializeFolder = function(fileSubPaths, baseFolderPath) {

                fileSubPaths.forEach(fileSubPath => {

                    let filePath = path.join(baseFolderPath, fileSubPath);

                    let parsed = path.parse(filePath);

                    return fs.ensureDir(parsed.dir)
                    .then(() => { 
                        return fs.exists(filePath);
                    })
                    .then(exists => {
                        let next = Promise.resolve();
                        if (exists) {
                            next = next.then(() => {
                                return fs.remove(filePath);
                            });
                        }
                        
                        next = next.then(() => {
                            return fs.writeFile(filePath, reverseString(parsed.name));
                        });
                    });
                });
            };

            const appendContinerName = function(fileSubPaths, containerName) {
                let ret = [];
                fileSubPaths.forEach(fileSubPath => {
                    ret.push(containerName + "/" + path.basename(fileSubPath));
                });

                return ret;
            }

            /**
             * 
             * @param {string} filePath 
             * @param {string} content 
             */
            const fileHasContent = function(baseFolder, fileSubPath, content) {
                let filePath = path.join(baseFolder, fileSubPath);

                return fs.exists(filePath)
                .then(exists => {
                    if (!exists) {
                        return false;
                    }
                    else {
                        return fs.readFile(path.join(baseFolder, fileSubPath), "utf8")
                        .then(fileContent => {
                            return fileContent === content;
                        });
                    }
                });
            };

            it("one file not overwritting", function() {

                const targets = ["simpleOneFile"];
                const keys = appendContinerName(targets, "write-file");
                

                let action = new actionTypes.WriteFileAction(
                    keys,
                    keys
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return fileHasContent(utils.PLAYGROUND_PATH, keys[0], targets[0]);
                })
                .should.eventually.equals(true);

            });

            it("one file overwritting", function() {
                fail();
            });

            it("one file inside path not overwritting", function() {
                fail();
            });

            it("one file in path overwritting", function() {
                fail();
            });

            it("many files not overwritting", function() {
                fail();
            });

            it("many files overwritting", function() {
                fail();                
            });

            it("many files inside path not overwritting", function() {
                fail();
            });

            it("many files inside path overwritting", function() {
                fail();
            });

            it("source not exist should fail", function() {
                fail();
            });
        });
    });
});