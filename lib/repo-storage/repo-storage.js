'use strict';

module.exports.RepoStorage = class RepoStorage {

    /**
     * 
     * @param {String} revisionName 
     * @param {String} sourcePath 
     * @returns {Promise<void>}
     */
    save(revisionName, sourcePath) {
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} destinationPath 
     * @returns {Promise<void>}
     */
    load(revisionName, destinationPath) {
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