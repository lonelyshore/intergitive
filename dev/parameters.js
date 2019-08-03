'use strict';

const readonly = require('../lib/readonly');

const STORAGE_TYPE = require('../lib/repo-vcs').STORAGE_TYPE;



let parameters = {
    defaultRepoStorageType: STORAGE_TYPE.ARCHIVE,
    defaultRepoStorageTypeName: STORAGE_TYPE.toString(this.defaultRepoStorageType)
}

parameters = readonly.wrap(parameters);

exports = module.exports = parameters;