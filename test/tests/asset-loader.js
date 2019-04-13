"use strict";

const AssetLoader = require("../../lib/asset-loader").AssetLoader;
const NotFoundError = require("../../lib/asset-loader").NotFoundError;
const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();

describe("AssetLoader", function() {
    describe("Load Assets", function() {

        const resourcePath = path.resolve(__dirname, "../resources/test-asset-loader/resources");
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
                return router.getFullAssetPath("ondisk-assets/picture")
                    .should.eventually
                    .equal(
                        path.join(
                            testCourceTestLanguagePath, 
                            "asset1.png"))
                    .then(() => {
                        return router.getFullAssetPath("ondisk-assets/text")
                            .should.eventually.equal(
                                path.join(
                                    testCourceTestLanguagePath, 
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
                return router.getFullAssetPath("ondisk-assets/default_fallback")
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
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
                return router.getFullAssetPath("ondisk-assets/redirect_fallback")
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
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
                return router.getFullAssetPath("ondisk-assets/default_double_fallback")
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetFallbackLanguagePath,
                        "default_double_fallback.txt"
                    )
                );
            });
        });

        describe("Handle Not Found", function() {

            it("infile not found", function() {
                return router.loadInfileAsset(`${infileAssets}/not_exists`)
                .should.eventually
                .be.an.instanceof(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, infileAssets),
                    assetName: "not_exists"
                });
            });
            
            it("ondisk not found", function() {
                return router.getFullAssetPath(`${ondiskAssets}/not_exists`)
                .should.eventually
                .be.an.instanceof(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguagePath, ondiskAssets),
                    finalContainerPath: path.join(testCourceTestLanguagePath, ondiskAssets),
                    assetName: "not_exists"                   
                });
            });

            it("infile fallback not found", function() {
                let assetName = "redirect_not_found";
                return router.loadInfileAsset(`${infile-assets}/${assetName}`)
                .should.eventually
                .be.an.instanceof(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguagePath, infileAssets),
                    finalContainerPath: path.join(fallbackTargetTestLanguagePath, infileAssets),
                    assetName: assetName
                });
            });

            it("ondisk fallback not found", function() {
                let assetName = "default_not_found";
                return router.getFullAssetPath(`${ondiskAssets}/${assetName}`)
                .should.eventually
                .be.an.instanceof(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguagePath, infileAssets),
                    finalContainerPath: path.join(fallbackTargetTestLanguagePath, infileAssets),
                    assetName: assetName
                });
            });
        });

        describe("Handle Bundle Not Found", function() {
            it("Direct Load Not Found", function() {
                return router.loadInfileAsset("not-exists/not-exists")
                .should.eventually
                .be.an.instanceof(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguagePath, "not-exists"),
                    finalContainerPath: path.join(testCourceTestLanguagePath, "not-exists"),
                    assetName: "not-exists"
                });
            })
        })

    })
})