'use strict';

const yaml = require('js-yaml');

/**
 * 
 * @param {Sring} typeName 
 */
function createDummyType(tag) {
    return new yaml.Type(tag, {
        kind: 'mapping',
        construct: function(data) { return {}; }
    })
}

const typeDict = {
    unstage: createDummyType('!dev.act.unstage'),
    unstageAll: createDummyType('!dev.act.unstageAll'),
    merge: createDummyType('!dev.act.merge'),
    continueMerge: createDummyType('!dev.act.continueMerge'),
    cleanCheckout: createDummyType('!dev.act.cleanCheckout'),
    gitCommand: createDummyType('!dev.act.git'),
    saveRepoReference: createDummyType('!dev.act.saveReference'),
    loadRepoReferenceArchive: createDummyType('!dev.act.loadRepoReferenceArchive'),
};

module.exports.devActionSchemaDict = typeDict;