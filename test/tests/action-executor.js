"use strict";

"use strict";

const path = require("path");
const fs = require("fs-extra");
const utils = require("./test-utils");
const ActionExecutor = require("../../lib/action-executor").ActionExecutor;

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

const fail = function() {
    throw new Error("fail");
}

describe.skip("Action Executor", function() {
    describe("File Operations", function() {
            
        before(function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH);
        });

        afterEach(function() {
            return fs.remove(utils.PLAYGROUND_PATH);
        });

        describe("Inject File", function() {

            it("one file not overwritting", function() {
                fail();
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