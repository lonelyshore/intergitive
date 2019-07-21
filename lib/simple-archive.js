"use strict";

const fs = require("fs-extra");
const path = require("path");
const AdmZip = require("adm-zip");

function archivePathIncludeRoot(sourcePath, outputPath) {
    return new Promise((resolve, reject) => {
        let zip = new AdmZip();
        zip.addLocalFolder(sourcePath, path.basename(outputPath, '.zip'));
        zip.writeZip(outputPath, (err) => {
            if (err) {
                reject(new Error(`[simple-archive] Error occured when archiving ${sourcePath} to ${outputPath}: ${err}`));
            }
            else {
                resolve();
            }
        });
    });
}

function archivePathWithoutRoot(sourcePath, outputPath) {
    return fs.readdir(sourcePath, { withFileTypes: true })
    .then(dirents => {
        return new Promise((resolve, reject) => {
            let zip = new AdmZip();
            dirents.forEach(dirent => {
                if (dirent.isDirectory()) {
                    zip.addLocalFolder(
                        path.join(sourcePath, dirent.name),
                        dirent.name
                    );
                }
                else {
                    zip.addLocalFile(
                        path.join(sourcePath, dirent.name),
                        '',
                        dirent.name
                    );
                }
            })

            zip.writeZip(outputPath, (err) => {
                if (err) {
                    reject(new Error(`[simple-archive] Error occured when archiving ${sourcePath} to ${outputPath}: ${err}`));
                }
                else {
                    resolve();
                }
            });
        });
    });
}

module.exports.archivePathTo = function(sourcePath, outputPath, includeRoot = true) {
    if (includeRoot) {
        return archivePathIncludeRoot(sourcePath, outputPath);
    }
    else {
        return archivePathWithoutRoot(sourcePath, outputPath);
    }
};

module.exports.extractArchiveTo = function(archivePath, extractedPath) {
    return fs.ensureDir(extractedPath)
    .then(() => {
        return new Promise((resolve, reject) => {
            let zip = new AdmZip(archivePath);
            zip.extractAllToAsync(extractedPath, true, (err) => {
                if (err) {
                    reject(new Error(`[simple-archive] Error occured when extracting ${archivePath} to ${extractedPath}: ${err}`));
                }
                else {
                    setTimeout(() => resolve(), 50); // wait to avoid some problems
                }
            });
        });
    });
};
