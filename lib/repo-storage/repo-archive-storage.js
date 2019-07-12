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

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');

const zip = require('../simple-archive');

const RepoStorage = require('./repo-storage');
const readonlyWrap = require('../readonly').wrap;

class Props {

    constructor(storePath) {
        this.archiveStoreName = 'archives';
        this.indexStoreName = 'index-store';
        this.cacheFolderName = 'cache';
        this.cacheRevisionLogName = 'CACHE_HEAD';
        this.storePath = storePath;
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
    }

    /**
     * 
     * @param {String} storePath 
     * @returns {Promise<void>}
     */
    setStorePath(storePath) {
        this.props = new Props(storePath);
        this.props = readonlyWrap(this.props);

        return fs.ensureDir(storePath)
        .then(() => {
            return fs.ensureDir(this.props.archiveStorePath);
        })
        .then(() => {
            return fs.ensureDir(this.props.indexStorePath);
        })
        .then(() => {
            return fs.ensureDir(this.props.cacheFolderPath);
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
        let archivePath = this.props.getRevisionArchivePath(revisionName);
        let serializedIndexPath = this.props.getRevisionIndexPath(revisionName);

        return fs.exists(archivePath)
        .then(archiveExists => {
            if (archiveExists) {
                return fs.remove(archivePath)
            }
        })
        .then(() => {
            return zip.archivePathTo(
                sourcePath,
                archivePath,
                false
            );
        })
        .then(() => {
            if (isSaveTemplate) {
                return fs.exists(serializedIndexPath)
                .then(indexExists => {
                    if (indexExists) {
                        return fs.remove(serializedIndexPath);
                    }
                })
                .then(() => {
                    return super.serializeIndex(
                        sourcePath,
                        this.props.getRevisionIndexPath(revisionName)
                    );
                })
            }
        });
    }

    /**
     * 
     * @param {String} revisionName 
     * @param {String} destinationPath 
     * @param {Boolean} isTEmplate
     * @returns {Promise<void>}
     */
    load(revisionName, destinationPath, isTemplate) {
        let archivePath = this.props.getRevisionArchivePath(revisionName);
        return fs.exists(archivePath)
        .then(archiveExists => {
            assert(archiveExists, `Expect ${revisionName} is saved before loaded`);
        })
        .then(() => {
            return fs.emptyDir(destinationPath);
        })
        .then(() => {
            return zip.extractArchiveTo(
                archivePath,
                destinationPath
            );
        })
    }

    /**
     * 
     * @param {String} revisionName
     * @returns {Promise<CacheInfo>} returns cachingPath and indexFilePath
     */
    loadToCache(revisionName) {
        
        let cachingLogPath = this.props.cacheRevisionLogPath;
        let cachingPath = this.props.cacheFolderPath;
        
        let loadLastCachedRevisionName = () => {
            return fs.exists(cachingLogPath)
            .then(cachingLogExists => {
                if (cachingLogExists) {
                    return fs.readFile(cachingLogPath);
                }
                else {
                    return undefined;
                }
            })
        }

        let loadRevisionIntoCache = () => {
            return fs.emptyDir(cachingPath)
            .then(() => {
                return this.load(revisionName, cachingPath, false);
            })
            .then(() => {
                return fs.writeFile(cachingLogPath, revisionName);
            });
        };

        let serializedIndexEntries;

        return Promise.resolve()
        .then(() => {
            assert(revisionName !== undefined);
        })
        .then(() => {
            return super.deserializeIndex(this.props.getRevisionIndexPath(revisionName))
            .then(result => {
                serializedIndexEntries = result;
            })
        })
        .then(() => {
            return loadLastCachedRevisionName();
        })
        .then(cachedRevisionName => {

            let cacheInfo = {
                cachingPath: cachingPath,
                serializedIndexEntries: serializedIndexEntries
            };

            if (cachedRevisionName === revisionName) {
                return cacheInfo;
            }
            else {
                return loadRevisionIntoCache()
                .then(() => {
                    return cacheInfo;
                })
            }
        });
        
    }    
}