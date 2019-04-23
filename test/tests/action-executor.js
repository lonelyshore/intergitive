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

        describe("Add File", function() {

            it("add one file source exists", function() {
                fail();
            });

            it("add multiple files all sources exist", function() {
                fail();
            });

            it("add one file source not exist should fail", function() {
                fail();
            });

            it("add multiple files any source not exist should fail", function() {
                fail();
            });

        });
    });
});