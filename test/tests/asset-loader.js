"use strict";

const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const NotFoundError = require("../../lib/asset-loader").NotFoundError;
const CyclicFallbackError = require("../../lib/asset-loader").CyclicFallbackError;
const path = require("path");
const utils = require("./test-utils");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

describe("AssetLoader", function() {
    describe("Load Assets", function() {

        const resourcePath = path.join(utils.RESOURCES_PATH, "/test-asset-loader/resources");
        
        const infileAssets = "infile-assets";
        const ondiskAssets = "ondisk-assets";
        const testCourceTestLanguageSubPath =
            path.join("test-course", "test-language");
        const testCourceTestLanguagePath = 
            path.join(resourcePath, testCourceTestLanguageSubPath);
        const fallbackTargetTestLanguageSubPath =
            path.join("fallback-target", "test-language");
        const fallbackTargetTestLanguagePath =
            path.join(resourcePath, fallbackTargetTestLanguageSubPath);
        const fallbackTargetFallbackLanguageSubPath =
            path.join("fallback-target", "fallback-language");
        const fallbackTargetFallbackLanguagePath =
            path.join(resourcePath, fallbackTargetFallbackLanguageSubPath);
        let router;

        beforeEach(function() {
            router = new AssetLoader(resourcePath);
            router.setBundlePath(
                "test-course",
                "test-language"
            );
        });

        describe("Direct Load", function() {

            it("infile correct load", function() {
                return router.loadInfileAsset("infile-assets/text")
                    .should.eventually
                    .equal("test-course->test-language->infile-assets");
            });
    
            it("ondisk path correctly routed", function() {
                return router.getFullAssetPath(`${ondiskAssets}/picture`)
                    .should.eventually
                    .equal(
                        path.join(
                            testCourceTestLanguagePath, 
                            ondiskAssets,
                            "asset1.png"))
                    .then(() => {
                        return router.getFullAssetPath(`${ondiskAssets}/text`)
                            .should.eventually.equal(
                                path.join(
                                    testCourceTestLanguagePath, 
                                    ondiskAssets,
                                    "asset2.txt"));
                    });
            });
        });

        describe("Simple Fallbacks", function() {

            it("infile default fallback", function() {
                return router.loadInfileAsset("infile-assets/default_fallback1")
                .should.eventually
                .equal("fallback text")
                .then(() => {
                    return router.loadInfileAsset("infile-assets/default_fallback2")
                    .should.eventually
                    .equal("多國語言にほんごالعربيةTiếng việtไทย");
                });
            });

            it("ondisk default fallback", function() {
                return router.getFullAssetPath(`${ondiskAssets}/default_fallback`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
                        ondiskAssets,
                        "asset1.png"
                    )
                );
            });

            it("infile redirect fallback", function() {
                return router.loadInfileAsset("infile-assets/redirect_fallback")
                .should.eventually
                .equal("\"DOUBLE QUOTE\"");
            });

            it("ondisk redirect fallback", function() {
                return router.getFullAssetPath(`${ondiskAssets}/redirect_fallback`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
                        ondiskAssets,
                        "asset2.txt"
                    )
                );
            });

        });

        describe("Double Fallbacks", function() {
            it("infile double fallback", function() {
                return router.loadInfileAsset("infile-assets/redirect_double_fallback")
                .should.eventually
                .equal("double_fallback");
            });

            it("ondisk double fallback", function() {
                return router.getFullAssetPath(`${ondiskAssets}/default_double_fallback`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetFallbackLanguagePath,
                        ondiskAssets,
                        "default_double_fallback.txt"
                    )
                );
            });
        });

        describe("Handle Not Found", function() {

            it("infile not found", function() {
                return router.loadInfileAsset(`${infileAssets}/not_exists`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    assetName: "not_exists"
                });
            });

            it("ondisk not found", function() {
                return router.getFullAssetPath(`${ondiskAssets}/not_exists`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, ondiskAssets),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, ondiskAssets),
                    assetName: "not_exists"                   
                });
            });

            it("infile fallback not found", function() {
                let assetName = "redirect_not_found";
                return router.loadInfileAsset(`${infileAssets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, infileAssets),
                    assetName: assetName
                });
            });

            it("ondisk fallback not found", function() {
                let assetName = "default_not_found";
                return router.getFullAssetPath(`${ondiskAssets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, ondiskAssets),
                    finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, ondiskAssets),
                    assetName: assetName
                });
            });
        });

        describe("Handle Container Not Found", function() {

            it("direct load not found", function() {
                return router.loadInfileAsset("not-exists/not-exists")
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, "not-exists"),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, "not-exists"),
                    assetName: "not-exists"
                });
            });

            it("fallback not found", function() {
                let assetName = "redirect_container_not_found";

                return router.loadInfileAsset(`${infileAssets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    finalContainerPath: path.join("not_exist", "not_exist", infileAssets),
                    assetName: assetName
                });
            });

        });

        describe("Fallback Cycle Detection", function() {

            it("cycle in redirect", function() {
                let assetName = "redirect_cyclic";

                return router.loadInfileAsset(`${infileAssets}/${assetName}`)
                .should.be.eventually.rejectedWith(CyclicFallbackError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    assetName: assetName
                });
            });

            it("cycle in default fallback", function() {
                let assetName = "default_cyclic";

                return router.getFullAssetPath(`${ondiskAssets}/${assetName}`)
                .should.be.eventually.rejectedWith(CyclicFallbackError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, ondiskAssets),
                    assetName: assetName
                });
            });

        });

    });

    describe("Empty Bundle Load", function() {

        let basePath = path.join(utils.RESOURCES_PATH, "test-asset-loader/empty-bundle");
        let assetLoader;

        beforeEach(function() {
            assetLoader = new AssetLoader(basePath);
            assetLoader.setBundlePath();
        });

        it("infile asset", function() {
            return Promise.all([
                assetLoader.loadInfileAsset("infile-assets/first")
                .should.eventually.equal("first-asset"),
                assetLoader.loadInfileAsset("infile-assets/second")
                .should.eventually.equal("second-asset")
            ]);
        });

        it("ondisk asset", function() {
            return Promise.all([
                assetLoader.getFullAssetPath("ondisk-assets/first")
                .should.eventually.equal(path.join(basePath, "ondisk-assets/first-asset.txt")),
                assetLoader.getFullAssetPath("ondisk-assets/second")
                .should.eventually.equal(path.join(basePath, "ondisk-assets/second-asset.txt"))
            ]);
        });
    })
});