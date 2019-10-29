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
    unstage: createDummyType('!act.unstage'),
    unstageAll: createDummyType('!act.unstageAll'),
    merge: createDummyType('!act.merge'),
    continueMerge: createDummyType('!act.continueMerge'),
    cleanCheckout: createDummyType('!act.cleanCheckout'),
    gitCommand: createDummyType('!act.git'),
    saveRepoReference: createDummyType('!act.saveReference'),
    loadRepoReferenceArchive: createDummyType('!act.loadRepoReferenceArchive'),
};

module.exports.devActionSchemaDict = typeDict;