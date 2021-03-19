'use strict'

const path = require('path')

const {
  AssetLoader,
  MutableAssetLoader,
  NotFoundError,
  CyclicFallbackError
} = require('../../src/main/asset-loader')

const utils = require('./test-utils')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
chai.should()

describe('AssetLoader #core', function () {
  describe('Mutability', function () {
    it('Cannot mutate bundle path state of AssetLoader', function () {
      const sourceBundlePaths = ['source', 'bundle', 'path']
      const anotherBundlePaths = ['another', 'bundle', 'path']
      const loader = new AssetLoader(__dirname, ...sourceBundlePaths)
      const another = loader.getLoaderForBundlePath(...anotherBundlePaths)

      loader.bundlePathElements.should.deep.equal(sourceBundlePaths)
      another.bundlePathElements.should.deep.equal(anotherBundlePaths)
    })

    it('Bundle path state of MutableAssetLoader can be mutated', function () {
      const sourceBundlePaths = ['source', 'bundle', 'path']
      const anotherBundlePaths = ['another', 'bundle', 'path']
      const loader = new MutableAssetLoader(__dirname, ...sourceBundlePaths)

      loader.bundlePathElements.should.deep.equal(sourceBundlePaths)

      loader.setBundlePath(...anotherBundlePaths)

      loader.bundlePathElements.should.deep.equal(anotherBundlePaths)
    })
  })

  describe('Functionalities', function () {
    const resourcePath = path.join(utils.RESOURCES_PATH, '/test-asset-loader/resources')

    const assets = 'assets'
    const testCourceTestLanguageSubPath =
            path.join('test-course', 'test-language')
    const testCourceTestLanguagePath =
            path.join(resourcePath, testCourceTestLanguageSubPath)
    const testCourceFallbackLanguageSubPath =
            path.join('test-course', 'fallback-language')
    const testCourceFallbackLanguagePath =
            path.join(resourcePath, testCourceFallbackLanguageSubPath)
    const fallbackTargetTestLanguageSubPath =
            path.join('fallback-target', 'test-language')
    const fallbackTargetTestLanguagePath =
            path.join(resourcePath, fallbackTargetTestLanguageSubPath)
    const fallbackTargetFallbackLanguageSubPath =
            path.join('fallback-target', 'fallback-language')
    const fallbackTargetFallbackLanguagePath =
            path.join(resourcePath, fallbackTargetFallbackLanguageSubPath)
    let assetLoader

    beforeEach(function () {
      assetLoader = new AssetLoader(resourcePath, 'test-course', 'test-language')
    })

    function testShouldContainAsset (assetId) {
      it(`contain ${assetId}`, function () {
        return assetLoader.containsAsset(assetId)
          .should.eventually.equal(true)
      })
    }

    function testShouldNotContainAsset (assetId) {
      it(`contain ${assetId}`, function () {
        return assetLoader.containsAsset(assetId)
          .should.eventually.equal(false)
      })
    }

    describe('Direct Load', function () {
      testShouldContainAsset(`${assets}/text:raw`)

      testShouldContainAsset(`${assets}/text:from-file`)

      testShouldContainAsset(`${assets}/picture`)

      it('raw text correct load', function () {
        return assetLoader.loadTextContent(`${assets}/text:raw`)
          .should.eventually
          .equal('test-course->test-language->infile-assets')
      })

      it('text content from file', function () {
        return assetLoader.loadTextContent(`${assets}/text:from-file`)
          .should.eventually.equal('The quick brown fox jumps over the lazy dog.')
      })

      it('ondisk path correctly routed', function () {
        return assetLoader.getFullAssetPath(`${assets}/picture`)
          .should.eventually
          .equal(
            path.join(
              testCourceTestLanguagePath,
              assets,
              'picture.png'))
      })
    })

    describe('Simple Fallbacks', function () {
      testShouldContainAsset(`${assets}/default_fallback_raw_text`)

      testShouldContainAsset(`${assets}/default_fallback_text_from_file`)

      testShouldContainAsset(`${assets}/default_fallback_asset_path`)

      testShouldContainAsset(`${assets}/another_default_fallback_raw_text`)

      testShouldContainAsset(`${assets}/another_default_fallback_text_from_file`)

      testShouldContainAsset(`${assets}/another_default_fallback_asset_path`)

      testShouldContainAsset(`${assets}/redirect_fallback_raw_text`)

      testShouldContainAsset(`${assets}/redirect_fallback_text_from_file`)

      testShouldContainAsset(`${assets}/redirect_fallback_asset_path`)

      it('default fallback to raw text', function () {
        return assetLoader.loadTextContent(`${assets}/default_fallback_raw_text`)
          .should.eventually.equal('fallback text')
      })

      it('default fallback text content from file', function () {
        return assetLoader.loadTextContent(`${assets}/default_fallback_text_from_file`)
          .should.eventually
          .equal('多國語言にほんごالعربيةTiếng việtไทย')
      })

      it('default fallback asset path', function () {
        return assetLoader.getFullAssetPath(`${assets}/default_fallback_asset_path`)
          .should.eventually
          .equal(
            path.join(
              fallbackTargetTestLanguagePath,
              assets,
              'asset1.png'
            )
          )
      })

      it('another default fallback to raw text', function () {
        return assetLoader.loadTextContent(`${assets}/another_default_fallback_raw_text`)
          .should.eventually.equal('another fallback text')
      })

      it('another default fallback text content from file', function () {
        return assetLoader.loadTextContent(`${assets}/another_default_fallback_text_from_file`)
          .should.eventually
          .equal('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Rhoncus urna neque viverra justo nec ultrices dui.')
      })

      it('another default fallback asset path', function () {
        return assetLoader.getFullAssetPath(`${assets}/another_default_fallback_asset_path`)
          .should.eventually
          .equal(
            path.join(
              testCourceFallbackLanguagePath,
              assets,
              'asset3.png'
            )
          )
      })

      it('redirect fallback to raw text', function () {
        return assetLoader.loadTextContent(`${assets}/redirect_fallback_raw_text`)
          .should.eventually
          .equal('"DOUBLE QUOTE"')
      })

      it('redirect fallback text content from file', function () {
        return assetLoader.loadTextContent(`${assets}/redirect_fallback_text_from_file`)
          .should.eventually
          .equal('\'SINGLE QUOTE\'')
      })

      it('redirect fallback asset path', function () {
        return assetLoader.getFullAssetPath(`${assets}/redirect_fallback_asset_path`)
          .should.eventually
          .equal(
            path.join(
              fallbackTargetTestLanguagePath,
              assets,
              'asset2.txt'
            )
          )
      })
    })

    describe('Double Fallbacks', function () {
      testShouldContainAsset(`${assets}/redirect_double_fallback_raw_text`)

      testShouldContainAsset(`${assets}/redirect_double_fallback_text_from_file`)

      testShouldContainAsset(`${assets}/default_double_fallback_asset_path`)

      testShouldContainAsset(`${assets}/another_default_double_fallback_asset_path`)

      it('double fallback to raw text', function () {
        return assetLoader.loadTextContent(`${assets}/redirect_double_fallback_raw_text`)
          .should.eventually
          .equal('double_fallback')
      })

      it('double fallback to text content from file', function () {
        return assetLoader.loadTextContent(`${assets}/redirect_double_fallback_text_from_file`)
          .should.eventually
          .equal('content of redirect_double_fallback_text_from_file')
      })

      it('default double fallback to asset path', function () {
        return assetLoader.getFullAssetPath(`${assets}/default_double_fallback_asset_path`)
          .should.eventually
          .equal(
            path.join(
              fallbackTargetFallbackLanguagePath,
              assets,
              'default_double_fallback.txt'
            )
          )
      })

      it('another default double fallback to asset path', function () {
        return assetLoader.getFullAssetPath(`${assets}/another_default_double_fallback_asset_path`)
          .should.eventually
          .equal(
            path.join(
              fallbackTargetFallbackLanguagePath,
              assets,
              'another_default_double_fallback.txt'
            )
          )
      })
    })

    describe('Handle Not Found', function () {
      testShouldNotContainAsset(`${assets}/not_exists`)

      testShouldNotContainAsset(`${assets}/redirect_not_found`)

      testShouldNotContainAsset(`${assets}/default_not_found`)

      testShouldNotContainAsset(`${assets}/another_default_not_found`)

      it('text content not found', function () {
        return assetLoader.loadTextContent(`${assets}/not_exists`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: 'not_exists'
          })
      })

      it('asset path not found', function () {
        return assetLoader.getFullAssetPath(`${assets}/not_exists`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: 'not_exists'
          })
      })

      it('asset path not found even if raw asset matches', function () {
        const assetName = 'text:raw'
        const targetKey = `${assets}/${assetName}`

        return assetLoader.loadTextContent(targetKey)
          .then()
          .should.be.fulfilled
          .then(() => {
            return assetLoader.getFullAssetPath(targetKey)
          })
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: assetName
          })
      })

      it('text content fallback not found', function () {
        const assetName = 'redirect_not_found'
        return assetLoader.loadTextContent(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, assets),
            assetName: assetName
          })
      })

      it('asset path fallback not found', function () {
        const assetName = 'default_not_found'
        return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(fallbackTargetTestLanguageSubPath, assets),
            assetName: assetName
          })
      })

      it('another asset path fallback not found', function () {
        const assetName = 'another_default_not_found'
        return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join(testCourceFallbackLanguageSubPath, assets),
            assetName: assetName
          })
      })
    })

    describe('Handle Container Not Found', function () {
      testShouldNotContainAsset('not-exists/not-exists')

      testShouldNotContainAsset('redirect_container_not_found')

      it('direct load not found', function () {
        return assetLoader.loadTextContent('not-exists/not-exists')
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, 'not-exists'),
            finalContainerPath: path.join(testCourceTestLanguageSubPath, 'not-exists'),
            assetName: 'not-exists'
          })
      })

      it('fallback to not existing container', function () {
        const assetName = 'redirect_container_not_found'

        return assetLoader.loadTextContent(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(NotFoundError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            finalContainerPath: path.join('not_exist', 'not_exist', assets),
            assetName: assetName
          })
      })
    })

    describe('Fallback Cycle Detection', function () {
      testShouldNotContainAsset('redirect_cyclic')

      testShouldNotContainAsset('default_cyclic')

      testShouldNotContainAsset('another_default_cyclic')

      it('cycle in redirect', function () {
        const assetName = 'redirect_cyclic'

        return assetLoader.loadTextContent(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(CyclicFallbackError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: assetName
          })
      })

      it('cycle in default fallback', function () {
        const assetName = 'default_cyclic'

        return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(CyclicFallbackError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: assetName
          })
      })

      it('another cycle in default fallback', function () {
        const assetName = 'another_default_cyclic'

        return assetLoader.getFullAssetPath(`${assets}/${assetName}`)
          .should.be.eventually.rejectedWith(CyclicFallbackError)
          .and.include({
            startingContainerPath: path.join(testCourceTestLanguageSubPath, assets),
            assetName: assetName
          })
      })
    })
  })

  describe('Empty Bundle Load', function () {
    const basePath = path.join(utils.RESOURCES_PATH, 'test-asset-loader/empty-bundle')
    let assetLoader

    function testShouldContainAsset (assetId) {
      it(`contain ${assetId}`, function () {
        return assetLoader.containsAsset(assetId)
          .should.eventually.equal(true)
      })
    }

    beforeEach(function () {
      assetLoader = new AssetLoader(basePath)
    })

    testShouldContainAsset('assets/text:raw')

    testShouldContainAsset('assets/text:from-file')

    testShouldContainAsset('assets/other')

    testShouldContainAsset('assets/text:from-file')

    it('raw text content', function () {
      return assetLoader.loadTextContent('assets/text:raw')
        .should.eventually.equal('raw content')
    })

    it('text content from file', function () {
      return assetLoader.loadTextContent('assets/text:from-file')
        .should.eventually.equal('content of text:from-file')
    })

    it('asset path', function () {
      return Promise.all([
        assetLoader.getFullAssetPath('assets/other')
          .should.eventually.equal(path.join(basePath, 'assets/other.txt')),
        assetLoader.getFullAssetPath('assets/text:from-file')
          .should.eventually.equal(path.join(basePath, 'assets/text-from-file.txt'))
      ])
    })
  })
})
