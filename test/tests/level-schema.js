'use strict';

const yaml = require('js-yaml');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.should();

describe('Load Level Config', function() {
    it('Production can recognize all dev steps', function() {
        let prodSchema = require('../../lib/level-config-schema').LEVEL_CONFIG_SCHEMA;
        let devSchema = require('../../dev/config-schema').LEVEL_CONFIG_SCHEMA;

        Object.keys(prodSchema.compiledTypeMap.mapping).should.contain.members(
            Object.keys(devSchema.compiledTypeMap.mapping)
        );
    })
});