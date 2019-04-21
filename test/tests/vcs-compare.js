"use strict";

const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

describe.skip("VCS Compare", function() {
    describe("Local", function() {
        describe("Equal", function() {
            it("clean stage and working directory", function() {
                const referenceName = "clean";

            });
    
            it("dirty stage", function() {
                const referenceName = "dirty-stage";

            });
    
            it("dirty working directory", function() {
                const referenceName = "dirty-directory";
                
            });
    
            it("merged", function() {
                const referenceName = "merged";

            });
    
            it("merging", function() {
                const referenceName = "merging";

            });
    
            it("merging conflict", function() {
                const referenceName = "conflict";

            });
    
            it("merging conflict editted", function() {
                const referenceName = "conflict-edit";
                
            });

            it("merging conflict staged", function() {
                const referenceName = "conflict-staged";

            });
    
            it("merging conflict resolved", function() {
                const referenceName = "conflict-resolved";
                
            });
    
            it("detached head", function() {
                const referenceName = "detached";
                
            });
        });
    
        describe("Different", function() {
    
        });
    });
});