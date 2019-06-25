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
    unstage: createDummyType('!unstage'),
    unstageAll: createDummyType('!unstageAll'),
    merge: createDummyType('!merge'),
    continueMerge: createDummyType('!continueMerge'),
    cleanCheckout: createDummyType('!cleanCheckout'),
    gitCommand: createDummyType('!git')
};

module.exports.devActionSchemaDict = typeDict;