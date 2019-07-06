'use strict';

const RepoStorage = require('./repo-storage');
const git = require('../git-kit');


const gitRepoFolderName = ".git";
const gitConfigFileSubPath = path.join('.git', 'config');
const wrapperFolderName = 'wrapper';
const repoFolderName = '_git_';
const indexFileName = 'index_serialization';

exports = module.exports = class GitStorage extends RepoStorage {

    constructor(isAutoCrlf) {
        this.storePath = '';
        this.isAutoCrlf = isAutoCrlf;
        this[repo] = null;
    }

    setStorePath(storePath) {

        this.storePath = storePath;
        
        let init = () => {
            this.backupWorkTreePath = path.join(this.storePath, wrapperFolderName);
            this.backupRepoPath = path.join(this.storePath, wrapperFolderName, repoFolderName);
            this.referenceGitRepoPath = path.join(this.storePath, wrapperFolderName, gitRepoFolderName);
            this.indexFilePath = path.join(this.storePath, wrapperFolderName, indexFileName);
        }

        let prepareRepository = () => Promise.resolve();

        if (!fs.existsSync(this.storePath)) {

            prepareRepository = () => {
                return fs.mkdirp(this.storePath)
                .then(() => { 
                    return git.Repository.init(this.storePath, 0);
                })
                .then(() => {
                    return fs.mkdirp(this.backupRepoPath);
                })
                .then(() => {
                    return fs.mkdirp(this.backupWorkTreePath);
                });
            };
        }

        return init()
        .then(() => {
            return prepareRepository()
        })
        .then(() => {
            return git.Repository.open(this.storePath)
            .then(result => {
                this[repo] = result;
            })
        })
        .then(() => {
            let configPath = path.join(this.storePath, gitConfigFileSubPath);
            return fs.exists(configPath)
            .then(exists => {
                if (!exists) {
                    return fs.createFile(configPath);
                }
                else{
                    return Promise.resolve();
                }
            })
            .then(() => {
                return git.Config.openOndisk(configPath);
            })
            .then(config => {
                return config.setString('core.autocrlf', this.isAutoCrlf ? 'true' : 'input');
            })
        })
    }

    save(revisionName, sourcePath) {

    }
};