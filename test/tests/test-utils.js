"use strict"

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const simpleGitCtor = require('simple-git/promise');
const random = require('seedrandom');
let rng = random('seed');

const resourcesPath = path.resolve(__dirname, "../resources");

function generateRepoHistorySummary(workingPath) {
    let repo = new simpleGitCtor(workingPath);

    let refCommits = [];
    
    return repo.raw(['show-ref', '-d', '--head'])
    .then(result => {
        if (result) {
            let lines = result.split('\n');
            lines.forEach(line => {
                if (line !== null && line.length !== 0) {
                    refCommits.push(line);
                }
            });
        }
    })
    .then(() => {
        refCommits.sort((a, b) => a < b);
    })
    .then(() => {
        return refCommits;
    });
}

function generateIndexDiffSummary(workingPath) {
    let repo = new simpleGitCtor(workingPath);

    let diffs = [];
    return repo.raw(['diff-index', '--cached', 'HEAD'])
    .then(result => {
        if (result) {
            let lines = result.split('\n');
            lines.forEach(line => {
                if (line !== null && line.length !== 0) {
                    let tokens = line.split('\t');
                    let filename = tokens[1];
                    let diff = tokens[0];
                    diffs.push(`${filename} ${diff}`);
                }
            })
        }
    })
    .then(() => {
        diffs.sort((a, b) => a < b);
    })
    .then(() => {
        return diffs;
    })
}

function getRepoStatus(workingPath) {
    let repo = new simpleGitCtor(workingPath);

    return repo.raw(['status']);
}

function getAllFilesRecursive(currentPath, shouldExplore) {

    let results = [];

    return fs.readdir(currentPath, { withFileTypes: true })
    .then(dirents => {
        let children = [];
        
        dirents.forEach(dirent => {
            let childPath = path.join(currentPath, dirent.name);
            if (dirent.isDirectory()) {
                if (shouldExplore(currentPath, dirent.name)) {
                    children.push(
                        getAllFilesRecursive(childPath, shouldExplore)
                    );
                }
            }
            else {
                results.push(childPath);
            }
        })

        return Promise.all(children);
    })
    .then(childrenResults => {
        childrenResults.forEach(childResults => {
            results = results.concat(childResults);
        })

        return results;
    });
}

function generateWorktreeSummary(workingPath) {

    let repo = new simpleGitCtor(workingPath);
    let summary = [];

    return getAllFilesRecursive(
        workingPath, 
        (currentPath, name) => {
            return currentPath === workingPath && name !== '.git';
        }
    )
    .then(files => {
        files.forEach((file, index) => {
            files[index] = path.relative(workingPath, file).replace(path.sep, '/');
        })

        return files;
    })
    .then(files => {
        let calcHashes = [];

        files.forEach(file => {
            calcHashes.push(
                repo.raw(['hash-object', file])
                .then(result => {
                    summary.push(`${file} ${result}`)
                })
            )
        })

        return Promise.all(calcHashes);
    })
    .then(() => {
        summary.sort((a, b) => a < b);
    })
    .then(() => {
        return summary;
    });
}

function areGitRepoSame(first, second, isVerbose) {
    return Promise.all([
        generateRepoHistorySummary(first),
        generateRepoHistorySummary(second)
    ])
    .then(summaries => {
        return compareSummaries(summaries, 'RepoHistory', isVerbose);
    })
    .then(historySame => {
        if (!historySame) {
            throw 'breaking';
        }
    })
    .then(() => {
        return Promise.all([
            generateIndexDiffSummary(first),
            generateIndexDiffSummary(second)
        ])
    })
    .then(summaries => {
        return compareSummaries(summaries, 'RepoIndex', isVerbose);
    })
    .then(indexSame => {
        if (!indexSame) {
            throw 'breaking';
        }
    })
    .then(() => {
        return Promise.all([
            getRepoStatus(first),
            getRepoStatus(second)
        ])
    })
    .then(statuses => {
        let areStatusesSame = statuses[0] === statuses[1];
        if (!areStatusesSame && isVerbose) {
            console.log('[RepoStatus] repos have different "git status" result')
        }
        return areStatusesSame;
    })
    .catch(err => {
        if (err === 'breaking') {
            return false;
        }
        else {
            console.error(err, err.stack);
            return false;
        }
    })
}

function compareSummaries(summaries, kind, isVerbose) {
    if (summaries.length !== 2) {
        if (isVerbose)
            console.log(`[${kind}] summaries should have length of 2`);
        return false;
    }

    let firstSummary = summaries[0];
    let secondSummary = summaries[1];

    if (firstSummary.length !== secondSummary.length) {
        if (isVerbose)
            console.log(`[${kind}] have different number of entries`);
        return false;
    }

    for (let i = 0; i < firstSummary.length; i++) {
        let firstEntry = firstSummary[i];
        let secondEntry = secondSummary[i];

        if (firstEntry !== secondEntry) {
            if (isVerbose)
                console.log(`[${kind}] have at least one different entry`);
            return false;
        }
    }

    return true;
}

function areWorkingTreeSame(first, second, isVerbose) {
    return Promise.all([
        generateWorktreeSummary(first),
        generateWorktreeSummary(second)
    ])
    .then(summaries => {
        return compareSummaries(summaries, 'WorkTree', isVerbose);
    })
}

function areDirectorySame(firstDir, secondDir, isVerbose) {
    isVerbose = isVerbose || false;

    return Promise.all([
        fs.pathExists(path.join(firstDir, '.git')),
        fs.pathExists(path.join(secondDir, '.git'))
    ])
    .then(areGitRepos => {
        if (areGitRepos.every(value => value === true)) {
            return areGitRepoSame(firstDir, secondDir, isVerbose)
            .then(areSame => {
                if (areSame) {
                    return areWorkingTreeSame(firstDir, secondDir, isVerbose);
                }
                else {
                    return false;
                }
            });
        }
        else if (areGitRepos.every(value => value === false)) {
            return areWorkingTreeSame(firstDir, secondDir, isVerbose);
        }
        else {
            if (isVerbose) {
                console.log('One is git repo but the other is not');
            }
            return false;
        }
    })
}

function shuffle(array) {
    
    for (let i = array.length - 1; i > 0; i--) {
        let randomIndex = Math.abs(rng.int32()) % (i + 1); // floor([0, i]
        let swap = array[i];
        array[i] = array[randomIndex];
        array[randomIndex] = swap;
    }
  
    return array;
}



module.exports.PLAYGROUND_PATH = path.resolve(__dirname, "../playground");
module.exports.RESOURCES_PATH = resourcesPath;
module.exports.ARCHIVE_RESOURCES_PATH = path.join(resourcesPath, "repo-archive");
module.exports.notImplemented = function() { throw new Error("Not Implemented"); }
module.exports.areDirectorySame = areDirectorySame;
module.exports.shuffle = shuffle;
module.exports.RepoArchiveConfigExecutor = class RepoArchiveConfigExecutor {

    constructor() {
        this.SCHEMA = require("../../dev/config-schema").LEVEL_CONFIG_SCHEMA;
        this.Action = require("../../lib/config-action").Action;
    }

    /**
     * 
     * @param {Array<Any>} contents 
     * @param {ActionExecutor} actionExecutor 
     */
    executeContents(contents, actionExecutor) {
        let executions = Promise.resolve();
        contents.forEach(item => {
            if (item instanceof this.Action) {
                executions = executions.then(() => {
                    return item.executeBy(actionExecutor)
                        .catch(err => {
                            console.error(`[execute ${item.klass}] ${err.message}`);
                            throw err;
                        });
                });
            }
        })

        return executions;
    }

    tryApplyReplay(executions, contents, stageMap, actionExecutor) {

        if (contents.length !== 0 && ("replay" in contents[0])) {
            let replayContents = [];
            contents[0]["replay"].forEach(replayName => {
                replayContents = replayContents.concat(stageMap[replayName]);
            });

            executions = executions.then(() => this.executeContents(replayContents, actionExecutor));
        }

        return executions;
    }

    executeStage(stageName, stageMap, actionExecutor) {

        if (!(stageName in stageMap)) {
            return Promise.reject(new Error(`Cannot find find stageName ${stageName}`));
        }

        let contents = stageMap[stageName];

        let executions = Promise.resolve();
        executions = this.tryApplyReplay(executions, contents, stageMap, actionExecutor);
        executions = executions.then(() => this.executeContents(contents, actionExecutor));
        return executions;
    }

    loadConfigIntoStageMapSync(configPath) {
        let content = fs.readFileSync(configPath);
        return this.loadStageMapFromConfigContent(content);
    }

    loadConfigIntoStageMap(configPath) {
        return fs.readFile(configPath)
        .then(content => {
            return this.loadStageMapFromConfigContent(content);
        })
    }

    loadStageMapFromConfigContent(content) {

        let config = yaml.safeLoad(content, { schema: this.SCHEMA });

        let stageMap = {};
        config.stages.forEach(stage => {
            stageMap[stage.name] = stage.contents;
        })

        return stageMap;
    }

}
