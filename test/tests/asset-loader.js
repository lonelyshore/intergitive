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

describe("AssetLoader #core", function() {
    describe("Load Assets", function() {

        const resourcePath = path.join(utils.RESOURCES_PATH, "/test-asset-loader/resources");
        
        const assets = "assets";
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
        let assetLoader;

        beforeEach(function() {
            assetLoader = new AssetLoader(resourcePath);
            assetLoader.setBundlePath(
                "test-course",
                "test-language"
            );
        });

        describe("Direct Load", function() {

            it('raw text correct load', function() {
                return assetLoader.loadTextContent(`${assets}/text:raw`)
                    .should.eventually
                    .equal("test-course->test-language->infile-assets");
            });

            it('text content from file', function() {
                return assetLoader.loadTextContent(`${assets}/text:from-file`)
                .should.eventually.equal('The quick brown fox jumps over the lazy dog.');
            })
    
            it("ondisk path correctly routed", function() {
                return assetLoader.getFullAssetPath(`${assets}/picture`)
                    .should.eventually
                    .equal(
                        path.join(
                            testCourceTestLanguagePath, 
                            assets,
                            "picture.png"));
            });

        });

        describe("Simple Fallbacks", function() {

            it('default fallback to raw text', function() {
                return assetLoader.loadTextContent("assets/default_fallback_raw_text")
                .should.eventually.equal("fallback text");
            });

            it('default fallback text content from file', function() {
                return assetLoader.loadTextContent("assets/default_fallback_text_from_file")
                .should.eventually
                .equal("多國語言にほんごالعربيةTiếng việtไทย");
            });

            it("default fallback asset path", function() {
                return assetLoader.getFullAssetPath(`${assets}/default_fallback_asset_path`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
                        assets,
                        "asset1.png"
                    )
                );
            });

            it("redirect fallback to raw text", function() {
                return assetLoader.loadTextContent("assets/redirect_fallback_raw_text")
                .should.eventually
                .equal("\"DOUBLE QUOTE\"");
            });

            it('redirect fallback text content from file', function() {
                return assetLoader.loadTextContent("assets/redirect_fallback_text_from_file")
                .should.eventually
                .equal("\'SINGLE QUOTE\'");
            });

            it("redirect fallback asset path", function() {
                return assetLoader.getFullAssetPath(`${assets}/redirect_fallback_asset_path`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetTestLanguagePath,
                        assets,
                        "asset2.txt"
                    )
                );
            });

        });

        describe("Double Fallbacks", function() {
            it("double fallback to raw text", function() {
                return assetLoader.loadTextContent("assets/redirect_double_fallback_raw_text")
                .should.eventually
                .equal("double_fallback");
            });

            it("double fallback to text content from file", function() {
                return assetLoader.loadTextContent("assets/redirect_double_fallback_text_from_file")
                .should.eventually
                .equal("content of redirect_double_fallback_text_from_file");
            });

            it("default double fallback to asset path", function() {
                return assetLoader.getFullAssetPath(`${assets}/default_double_fallback_asset_path`)
                .should.eventually
                .equal(
                    path.join(
                        fallbackTargetFallbackLanguagePath,
                        assets,
                        "default_double_fallback.txt"
                    )
                );
            });
        });

        describe("Handle Not Found", function() {

            it("text content not found", function() {
                return assetLoader.loadTextContent(`${assets}/not_exists`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    assetName: "not_exists"
                });
            });

            it("asset path not found", function() {
                return assetLoader.getFullAssetPath(`${assets}/not_exists`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    assetName: "not_exists"                   
                });
            });

            it("text content fallback not found", function() {
                let assetName = "redirect_not_found";
                return assetLoader.loadTextContent(`${assets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, assets),
                    assetName: assetName
                });
            });

            it("asset path fallback not found", function() {
                let assetName = "default_not_found";
                return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, assets),
                    assetName: assetName
                });
            });
        });

        describe("Handle Container Not Found", function() {

            it("direct load not found", function() {
                return assetLoader.loadTextContent("not-exists/not-exists")
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, "not-exists"),
                    finalContainerPath: path.join(testCourceTestLanguageSubPath, "not-exists"),
                    assetName: "not-exists"
                });
            });

            it("fallback to not existing container", function() {
                let assetName = "redirect_container_not_found";

                return assetLoader.loadTextContent(`${assets}/${assetName}`)
                .should.be.eventually.rejectedWith(NotFoundError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    finalContainerPath: path.join("not_exist", "not_exist", assets),
                    assetName: assetName
                });
            });

        });

        describe("Fallback Cycle Detection", function() {

            it("cycle in redirect", function() {
                let assetName = "redirect_cyclic";

                return assetLoader.loadTextContent(`${assets}/${assetName}`)
                .should.be.eventually.rejectedWith(CyclicFallbackError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
                    assetName: assetName
                });
            });

            it("cycle in default fallback", function() {
                let assetName = "default_cyclic";

                return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
                .should.be.eventually.rejectedWith(CyclicFallbackError)
                .and.include({
                    startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
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

        it("raw text content", function() {
            return assetLoader.loadTextContent('assets/text:raw')
                .should.eventually.equal('raw content');
        });

        it("text content from file", function() {
            return assetLoader.loadTextContent('assets/text:from-file')
                .should.eventually.equal('content of text:from-file');
        });

        it("asset path", function() {
            return Promise.all([
                assetLoader.getFullAssetPath("assets/other")
                .should.eventually.equal(path.join(basePath, "assets/other.txt")),
                assetLoader.getFullAssetPath("assets/text:from-file")
                .should.eventually.equal(path.join(basePath, "assets/text-from-file.txt"))
            ]);
        });
    })
});