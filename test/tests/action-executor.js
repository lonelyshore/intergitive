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

describe.skip("Action Executor", function() {
    describe("File Operations", function() {
            
        beforeEach(function() {
            return fs.ensureDir(utils.PLAYGROUND_PATH);
        });

        afterEach(function() {
            return fs.emptyDir(utils.PLAYGROUND_PATH)
            .then(() => {
                return fs.remove(utils.PLAYGROUND_PATH);
            });
        });

        describe("add a file", () => {

            let tempPath;

            before(function() {
                return fs.mkdtemp(os.tmpdir() + path.sep)
                .then(result => {
                    tempPath = result;
                })
            });
            after(function() {
                return fs.rmdir(tempPath);
            });

            it("add file exists", () => {
                
            })

        });
    });
});