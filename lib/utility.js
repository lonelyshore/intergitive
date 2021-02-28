'use strict';

const readonly = require('./readonly');

const AssetLoader = require('./asset-loader').AssetLoader;

module.exports.wait = function(milliseconds) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), milliseconds);
    });
}

const matchMustacheAssetId = /[\$\#\^]?{{[\s\w\d:\/\-_\.]*}}/g;

let mustacheMatchType = {
    MUSTACHE_ONLY: Symbol('MustacheOnly'),
    WITH_DOLLAR_SIGN: Symbol('WithDollarSign'),
    WITH_NUMBER_SIGN: Symbol('WithNumberSign'),
    WITH_CARET: Symbol('WithCaret'),
}

mustacheMatchType = readonly.wrap(mustacheMatchType);

/**
 * 
 * @callback ReplaceCallback
 * @param {MustacheReplacement} replacementInfo
 */

class MustacheReplacement {
    /**
     * 
     * @param {string} fullText
     * @param {Number} startingIndex
     * @param {Number} endingIndex
     */
    constructor(fullText, startingIndex, endingIndex) {
        if (fullText[startingIndex] === '$') {
            this.type = mustacheMatchType.WITH_DOLLAR_SIGN;
        }
        else if (fullText[startingIndex] === '#') {
            this.type = mustacheMatchType.WITH_NUMBER_SIGN;
        }
        else if (fullText[startingIndex] === '^') {
            this.type = mustacheMatchType.WITH_CARET;
        }
        else {
            this.type = mustacheMatchType.MUSTACHE_ONLY;
        }

        this.fullText = fullText;
        this.startingIndex = startingIndex;
        this.endingIndex = endingIndex;
    }

    get matched() {
        return this.fullText.substring(this.startingIndex, this.endingIndex);
    }

    get matchedContent() {
        if (this.type === mustacheMatchType.MUSTACHE_ONLY) {
            return this.matched.slice(2, this.matched.length - 2).trim();
        }
        else {
            return this.matched.slice(3, this.matched.length - 2).trim();
        }
    }

    /**
     * 
     * @param {ReplaceCallback} mustacheOnly 
     * @param {ReplaceCallback} withDollarSign
     * @param {ReplaceCallback} withNumberSign
     * @param {ReplaceCallback} withCaret
     */
    match(mustacheOnly, withDollarSign, withNumberSign, withCaret) {
        if (this.type === mustacheMatchType.MUSTACHE_ONLY) {
            return mustacheOnly(this);
        }
        else if (this.type === mustacheMatchType.WITH_DOLLAR_SIGN) {
            return withDollarSign(this);
        }
        else if (this.type === mustacheMatchType.WITH_CARET) {
            return withCaret(this);
        }
        else {
            return withNumberSign(this);
        }
    }
}

/**
 * 
 * @param {string} text 
 * @param {AssetLoader} assetLoader 
 * @returns {Promise<MustacheReplacement>} a promise that yields a list of MustacheReplacement
 */
function searchMustacheReplacementPairs(text) {
    let replacements = [];
    let matches;
    
    while ((matches = matchMustacheAssetId.exec(text)) !== null) {
        replacements.push(new MustacheReplacement(
            text,
            matches.index,
            matchMustacheAssetId.lastIndex
        ));
    }

    return Promise.resolve(replacements);
}

/**
 * 
 * @param {string} baseText
 * @param {Number} nextIndex
 * @param {Promise<string>} replacementLoader
 */
function getConcatMustacheReplaced(baseText, nextIndex, replacementLoader) {
    return (mustacheReplacement) => {
        return replacementLoader(mustacheReplacement)
        .then(replcingContent => {
            return baseText.concat(
                replcingContent
            ).concat(
                mustacheReplacement.fullText.substring(mustacheReplacement.endingIndex, nextIndex)
            );
        });
    }
}


function processMustacheEscapeInText(text) {
    const matchEscapedMustache = /\\({)|\\(})/g;
    return text.replace(matchEscapedMustache, '$1$2')
}

module.exports.searchMustacheReplacementPairs = searchMustacheReplacementPairs;
module.exports.processMustacheEscapeInText = processMustacheEscapeInText;
module.exports.matchMustacheAssetId = matchMustacheAssetId;
module.exports.getConcatMustacheReplaced = getConcatMustacheReplaced;
module.exports.typeCheck = {

    isString: function(obj) {
        return typeof obj === 'string' || obj instanceof String;
    },
    
    isBool: function(obj) {
        return typeof(obj) === 'boolean';
    },

    isNumber: function(obj) {
        return typeof(obj) === 'number';
    },

    isArray: function(obj) {
        return Array.isArray(obj);
    }
    

}