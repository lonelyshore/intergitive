"use strict";

const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const path = require("path");

describe("AssetLoader", function() {
    describe("Load Assets", function() {

        const resourcePath = path.resolve(__dirname, "../resources/test-asset-router/resources");
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
                .should.eventually.equal("asset1.png")
                .then(() => {
                    return router.getFullAssetPath("ondisk-assets/text")
                        .should.eventually.equal("asset2.txt");
                });
        })
    })
})