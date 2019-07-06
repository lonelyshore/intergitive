'use strict';

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
     * @returns {Promise<String>}
     */
    loadToCache(revisionName) {
        return Promise.reject(new Error('Not implemented'));
    }
}