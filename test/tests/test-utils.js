"use strict"

const fs = require('fs-extra');
const path = require("path");
const simpleGitCtor = require('simple-git/promise');

const resourcesPath = path.resolve(__dirname, "../resources");

function generateRepoHistorySummary(workingPath) {
    let repo = new simpleGitCtor(workingPath);

    let refCommits = [];
    
    return repo.raw(['show-ref', '-d'])
    .then(result => {
        let lines = result.split('\n');
        lines.forEach(line => {
            if (line !== null && line.length !== 0) {
                refCommits.push(line);
            }
        });
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
        let lines = result.split('\n');
        lines.forEach(line => {
            if (line !== null && line.length !== 0) {
                let tokens = line.split('\t');
                let filename = tokens[1];
                let diff = tokens[0];
                diffs.push(`${filename} ${diff}`);
            }
        })
    })
    .then(() => {
        diffs.sort((a, b) => a < b);
    })
    .then(() => {
        return diff;
    })
}

function getAllFilesRecursive(currentPath, shouldExplore) {

    let results = [];

    return fs.readdir(currentPath, { withFileTypes: true })
    .then(dirents => {
        let children = [];
        
        dirents.forEach(dirent => {
            let childPath = path.join(currentPath, dirent.name);
            if (dirent.isDirectory() && shouldExplore(currentPath, dirent.name)) {
                children.push(
                    getAllFilesRecursive(childPath, shouldExplore)
                );
            }
            else {
                results.push(childPath);
            }
        })

        return Promise.all(children);
    })
    .then(childrenResults => {
        childrenResults.forEach(childResults => {
            results.concat(childResults);
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
    })
    .then(() => {
        summary.sort((a, b) => a < b);
    })
    .then(() => {
        return summary;
    });
}

function areGitRepoSame(first, second) {
    return Promise.all([
        generateRepoHistorySummary(first),
        generateRepoHistorySummary(second)
    ])
    .then(summaries => {
        return compareSummaries(summaries, 'RepoHistory');
    })
    .then(historySame => {
        if (historySame) {
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
        return compareSummaries(summaries, 'RepoIndex');
    })
    .catch(err => {
        if (err === 'breaking') {
            return false;
        }
        else {
            console.error(err);
            return false;
        }
    })
}

function compareSummaries(summaries, kind) {
    if (summaries.length !== 2) {
        console.log(`[${kind}] summary of ${first} and ${second} should have length of 2`);
        return false;
    }

    let firstSummary = summaries[0];
    let secondSummary = summaries[1];

    if (firstSummary.length !== secondSummary.length) {
        console.log(`[${kind}] ${first} and ${second} have different number of entries`);
        return false;
    }

    for (let i = 0; i < firstSummary.length; i++) {
        let firstEntry = firstSummary[i];
        let secondEntry = secondSummary[i];

        if (firstEntry !== secondEntry) {
            console.log(`[${kind}] ${first} and ${second} have at least one different entry`);
            return false;
        }
    }

    return true;
}

function areWorkingTreeSame(first, second) {
    return Promise.all([
        generateWorktreeSummary(first),
        generateWorktreeSummary(second)
    ])
    .then(summaries => {
        return compareSummaries(summaries, 'WorkTree');
    })
}

function areDirectorySame(firstDir, secondDir) {
    return Promise.all([
        fs.pathExists(path.join(firstDir, '.git')),
        fs.pathExists(path.join(secondDir, '.git'))
    ])
    .then(areGitRepos => {
        if (areGitRepos.every(value => value === true)) {
            return areGitRepoSame(firstDir, secondDir)
            .then(areSame => {
                if (areSame) {
                    return areWorkingTreeSame(firstDir, secondDir);
                }
                else {
                    return false;
                }
            });
        }
        else if (areGitRepos.every(value => value === false)) {
            return areWorkingTreeSame(firstDir, secondDir);
        }
        else {
            return false;
        }
    })
}

module.exports.PLAYGROUND_PATH = path.resolve(__dirname, "../playground");
module.exports.RESOURCES_PATH = resourcesPath;
module.exports.ARCHIVE_RESOURCES_PATH = path.join(resourcesPath, "repo-archive");
module.exports.notImplemented = function() { throw new Error("Not Implemented"); }
module.exports.areDirectorySame = areDirectorySame;