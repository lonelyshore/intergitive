"use strict";

"use strict";

const path = require("path");
const fs = require("fs-extra");
const utils = require("./test-utils");
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
        actionExecutor = new ActionExecutor();
    })

    describe("File Operations", function() {
            
        beforeEach("Initialize Playground", function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        });

        afterEach("Remove Playground", function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        describe("Inject File", function() {

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
            }

            /**
             * 
             * @param {string} filePath 
             * @param {string} content 
             */
            const fileHasContent = function(baseFolder, fileSubPath, content) {
                return fs.readFile(path.join(baseFolder, fileSubPath), "utf8")
                .then(fileContent => {
                    return fileContent === content;
                });
            }

            it("one file not overwritting", function() {

                const keys = ["simpleOneFile"];

                initializeFolder(keys, utils.PLAYGROUND_PATH);

                let action = new actionTypes.InjectFileAction(
                    keys,
                    keys
                );

                return action.executeBy(actionExecutor)
                .then(() => {
                    return fileHasContent(utils.PLAYGROUND_PATH, keys[0], keys[0]);
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