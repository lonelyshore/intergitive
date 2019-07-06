'use strict';

/**
 * 
 * folder layout:
 *   - storePath
 *     - archive-store  // where the repository archives located
 *       - revisionName.zip
 *       - anotherRevision.zip
 *       - ...
 *     - index-store  // where serialized indices located
 *       - revisionName
 *       - anotherRevision
 *       - ...
 *     - cache  // the temporary path for comparing saved repositories
 *       - .git
 *       - files
 *     - CACHE_HEAD  // stores what is the currently checked out revision
 * 
 */

const path = require('path');
const fs = require('fs-extra');

const RepoStorage = require('./repo-storage');
const readonlyWrap = require('../readonly').wrap;

class Props {

    constructor() {
        this.archiveStoreName = 'archives';
        this.indexStoreName = 'index-store';
        this.cacheFolderName = 'cache';
        this.cacheRevisionLogName = 'CACHE_HEAD';
        this.storePath = '';
    }

    get archiveStorePath() {
        return path.join(this.storePath, this.archiveStoreName);
    }

    get indexStorePath() {
        return path.join(this.storePath, this.indexStoreName);
    }

    get cacheFolderPath() {
        return path.join(this.storePath, this.cacheFolderName);
    }

    get cacheRevisionLogPath() {
        return path.join(this.storePath, this.cacheRevisionLogName);
    }

    setStorePath(storePath) {
        this.storePath = storePath;
    }

    getRevisionArchivePath(revisionName) {
        return path.join(this.archiveStorePath, revisionName) + '.zip';
    }

    getRevisionIndexPath(revisionName) {
        return path.join(this.indexStorePath, revisionName);
    }
}


/**
 * @inheritdoc
 */
exports = module.exports = class ArchiveRepoStorage extends RepoStorage {

    constructor() {
        super();

        this.storePath = '';
        this.props = readonlyWrap(new Props());
    }

    /**
     * 
     * @param {String} storePath 
     * @returns {Promise<void>}
     */
    setStorePath(storePath) {
        return fs.ensureDir(storePath)
        .then(() => {
            return fs.ensureDir(this.props.archiveStorePath);
        })
        .then(() => {
            return fs.ensureDir(this.indexStorePath);
        })
        .then(() => {
            return fs.ensureDir(this.props.cacheFolderPath);
        })
        .then(() => {
            this.props.setStorePath(storePath);
        });
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
}