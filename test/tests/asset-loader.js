"use strict";

const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

describe("AssetLoader", function() {
    describe("Load Assets", function() {

        const resourcePath = path.resolve(__dirname, "../resources/test-asset-loader/resources");
        const testCourceTestLanguagePath = path.join("test-course", "test-language");
        let router;

        beforeEach(function() {
            router = new AssetLoader(resourcePath);
            router.setBundlePath(
                "test-course",
                "test-language"
            );
        });

        it("infile correct load", function() {
            return router.loadInfileAsset("infile-assets/text")
                .should.eventually.equal("test-course->test-language->infile-assets");
        });

        it("ondisk path correctly routed", function() {
            return router.getFullAssetPath("ondisk-assets/picture")
                .should.eventually.equal(path.join(resourcePath, testCourceTestLanguagePath, "asset1.png"))
                .then(() => {
                    return router.getFullAssetPath("ondisk-assets/text")
                        .should.eventually.equal(path.join(resourcePath, testCourceTestLanguagePath, "asset2.txt"));
                });
        })
    })
})