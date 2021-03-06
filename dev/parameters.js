'use strict';

const readonly = require('../src/common/readonly');

const STORAGE_TYPE = require('../src/main/repo-vcs').STORAGE_TYPE;



let parameters = {
    defaultRepoStorageType: STORAGE_TYPE.ARCHIVE,
    defaultRepoStorageTypeName: STORAGE_TYPE.toString(STORAGE_TYPE.ARCHIVE)
};

parameters = readonly.wrap(parameters);

exports = module.exports = parameters;