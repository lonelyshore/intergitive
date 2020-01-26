'use strict';

const AssetLoader = require('./asset-loader').AssetLoader;

module.exports.wait = function(milliseconds) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), milliseconds);
    });
}

const matchMustacheAssetId = /\$?{{[\s\w\d:\/\-_\.]*}}/g;

/**
 * 
 * @callback ReplaceCallback
 * @param {string} replacedString
 * @param {string} replacingString
 */

class MustacheReplacement {
    /**
     * 
     * @param {boolean} isReplacePath 
     * @param {string} replacedString 
     * @param {string} replacingString 
     */
    constructor(isReplacePath, replacedString, replacingString) {
        this.isReplacePath = isReplacePath;
        this.replacedString = replacedString;
        this.replacingString = replacingString;
    }

    /**
     * 
     * @param {ReplaceCallback} replaceContent 
     * @param {ReplaceCallback} replacePath 
     */
    match(replaceContent, replacePath) {
        if (this.isReplacePath) {
            return replacePath(this.replacedString, this.replacingString);
        }
        else {
            return replaceContent(this.replacedString, this.replacingString);
        }
    }
}

/**
 * 
 * @param {string} text 
 * @param {AssetLoader} assetLoader 
 * @returns {Promise} a promise that yields a list of MustacheReplacement
 */
function searchMustacheReplacementPairs(text, assetLoader) {
    let replacements = [];
    let setReplacementMap = [];
    let matches = text.match(matchMustacheAssetId);

    if (matches === null){
        return Promise.resolve(replacements);
    }
    else {
        matches.forEach(matched => {
            if (matched.startsWith('$')) {
                let assetKey = matched.slice(3, matched.length - 2).trim();
                setReplacementMap.push(
                    assetLoader.loadTextContent(assetKey)
                    .then(content => {
                        replacements.push(
                            new MustacheReplacement(
                                false,
                                matched,
                                content
                            )
                        );
                    })
                );
            }
            else {
                let assetKey = matched.slice(2, matched.length - 2).trim();
                setReplacementMap.push(
                    assetLoader.getFullAssetPath(assetKey)
                    .then(fullAssetPath => {
                        replacements.push(
                            new MustacheReplacement(
                                true,
                                matched,
                                fullAssetPath
                            )
                        );
                    })
                );
            }
        })

        return Promise.all(setReplacementMap)
        .then(() => replacements);
    }
}

function processMustacheEscapeInText(text) {
    const matchEscapedMustache = /\\({)|\\(})/g;
    return text.replace(matchEscapedMustache, '$1$2')
}

module.exports.searchMustacheReplacementPairs = searchMustacheReplacementPairs;
module.exports.processMustacheEscapeInText = processMustacheEscapeInText;
module.exports.matchMustacheAssetId = matchMustacheAssetId;