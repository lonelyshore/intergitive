"use strict";

const fs = require("fs-extra");
const path = require("path");
const AdmZip = require("adm-zip");

module.exports.archivePathTo = function(sourcePath, outputPath) {
    return new Promise((resolve, reject) => {
        let zip = new AdmZip();
        zip.addLocalFolder(sourcePath, path.basename(outputPath, '.zip'));
        zip.writeZip(outputPath, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};

module.exports.extractArchiveTo = function(archivePath, extractedPath) {
    return fs.ensureDir(extractedPath)
    .then(() => {
        return new Promise((resolve, reject) => {
            let zip = new AdmZip(archivePath);
            zip.extractAllToAsync(extractedPath, true, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    setTimeout(() => resolve(), 50); // wait to avoid some problems
                }
            });
        });
    });
};
