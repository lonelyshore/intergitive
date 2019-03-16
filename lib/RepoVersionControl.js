
"use strict";

const fs = require("fs-extra");
const git = require("nodegit");
const path = require('path');
const assert = require('asser');

function _signature() {
    return git.Signature.now("backup", "backup@serv.ice");
}

/**
 * Copy the file or the whole folder from source path to a rebased destination path
 * @param {string} sourcePath  The path to the file or folder that will be copied
 * @param {string} sourceBasePath The base path of the source that will be replaced by destinationBasePath
 * @param {string} destinationBasePath The base path of the destination
 */
function _copy(sourcePath, sourceBasePath, destinationBasePath) {
    return fs.stat(sourcePath)
    .then((stat) => {
        if (stat.isDirectory) {
            let targetPath = path.join(destinationBasePath, sourcePath.replace(sourceBasePath, ""));
            return fs.mkdir(targetPath)
            .then(() =>{
                return fs.copy(sourcePath, targetPath, { preserveTimestamps: true });
            });
        }
        else {
            return fs.copy(
                sourcePath, 
                path.join(destinationBasePath, sourcePath.replace(sourceBasePath, "")), 
                { preserveTimestamps: true });
        }
    });
}

exports = module.exports = class RepoVersionControl {

    static get wrapperFolderName() { return "wrapper"; }
    static get repoFolderName() { return "_git_"; }
    static get workTreeFolderName() { return "work_tree"; }

    constructor(storesPath) {
        this.storesPath = storesPath;

        fs.ensureDirSync(this.storesPath);
    }

    setTarget(sourcePath, storeName) {

        assert(fs.existsSync(sourcePath));
        assert(fs.existsSync(this.storesPath));

        this.sourceRepoPath = sourcePath;
        this.storePath = path.join(this.storesPath, storeName);
        this.backupWorkTreePath = path.join(this.storePath, wrapperFolderName(), workTreeFolderName());
        this.backupRepoPath = path.join(this.storePath, wrapperFolderName(), repoFolderName());

        if (!fs.existsSync(this.storePath)) {

            return fs.mkdirp(this.storePath)
            .then(() => { 
                return git.Repository.init(this.storePath, isBare=false);
            })
            .then(() => {
                return fs.mkdirp(this.backupRepoPath);
            })
            .then(() => {
                return fs.mkdirp(this.backupWorkTreePath);
            })
            .catch(() => {
                console.error(err);
            });
        }
        else {
            return Promise.resolve();
        }
    }

    backup(tagName) {
        
        assert(fs.existsSync(sourcePath));
        assert(fs.existsSync(this.storePath));
        assert(fs.existsSync(path.join(this.storePath, '.git')));

        let copyWorkTree = fs.emptyDir(this.backupWorkTreePath)
        .then(() => {
            return fs.readdir(this.sourceRepoPath);
        })
        .then((sourcePaths) => {
            let copies = Promise.resolve();

            sourcePaths.forEach((sourcePath) => {

                if (path.basename(sourcePath) !== '.git') {
                    copies = copies.then(_copy(sourcePath, this.sourceRepoPath, this.backupWorkTreePath));
                }

            })

            return copies;
        });

        let clearRepo = fs.readdir(this.backupRepoPath)
        .then((repoChildPaths) => {
            let removes = Promise.resolve();

            repoChildPaths.forEach((repoChildPath) => {
                if (path.basename(repoChildPath) !== "objects") {
                    removes = removes.then(fs.remove(repoChildPath));
                }
            })

            return removes;
        });

        let copyRepo = fs.readdir(path.join(this.sourceRepoPath, ".git"))
        .then((sourcePaths) => {
            let copies = Promise.resolve();
            sourcePaths.forEach((sourcePath) => {
                if (path.basename(sourcePath) !== "objects") {
                    copies = copies.then(_copy(sourcePath, path.join(this.sourceRepoPath, ".git"), this.backupRepoPath));
                }
            })

            return copies;
        })
        .then(() => {
            return fs.copy(
                path.join(this.sourceRepoPath, ".git", "objects"),
                path.join(this.backupRepoPath, "objects"), 
                {
                    overwrite: false,
                    preserveTimestamps: true,
                });
        });

        let repo;
        let index;
        let oid;
        let commitAndTag = git.Repository.open(this.backupRepoPath)
        .then((repoResult) => {
            repo = repoResult;
            return repo.index();
        })
        .then((indexResult) => {
            index = indexResult;
            return index.addAll();
        })
        .then(() => {
            return index.writeTree();
        })
        .then((oidResult) => {
            oid = oidResult;
            return git.Reference.nameToId(repo, "HEAD");
        })
        .then((head) => {
            return repo.getCommit(head);
        })
        .then((head) => {
            return repo.createCommit("HEAD", _signature(), _signature(), tagName, oid, [head]);
        })
        .then((commitOid) => {
            return repo.createLightWeightTag(commitOid, tagName);
        })

        return copyWorkTree.then(clearRepo).then(copyRepo).then(commitAndTag);
    }
}
