'use strict';

const fs = require('fs-extra');
const git = require('../git-kit');
const repoSerialization = require('../repo-serilization');

/**
 * @typedef {Object} CacheInfo
 * @property {String} cachingPath
 * @property {String} indexFilePath
 */

/**
 * @class
 */
exports = module.exports = class RepoStorage {

    /**
     * 
     * @param {String} storePath 
     * @returns {Promise<void>}
     */
    setStorePath(storePath) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} sourcePath 
     * @param {Boolean} isSaveTemplate
     * @returns {Promise<void>}
     */
    save(revisionName, sourcePath, isSaveTemplate) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} destinationPath 
     * @param {Boolean} isTEmplate
     * @returns {Promise<void>}
     */
    load(revisionName, destinationPath, isTemplate) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName
     * @returns {Promise<CacheInfo>} returns cachingPath and indexFilePath
     */
    loadToCache(revisionName) {
        return Promise.reject(new Error('Not implemented'));
    }

    serializeIndex(sourcePath, indexFilePath) {
        return git.Repository.open(sourcePath)
        .then((repoResult) => {
            return repoResult.refreshIndex();
        })
        .then((indexResult) => {
            return repoSerialization.seriailzeIndex(indexResult);
        })
        .then((dataString) => {
            return fs.writeFile(
                indexFilePath,
                dataString
            );
        });
    }
}