'use strict'

const fs = require('fs-extra')
const path = require('path')
const AdmZip = require('adm-zip')

function archivePathIncludeRoot (sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    const zip = new AdmZip()
    zip.addLocalFolder(sourcePath, path.basename(outputPath, '.zip'))
    zip.writeZip(outputPath, (err) => {
      if (err) {
        reject(new Error(`[simple-archive] Error occured when archiving ${sourcePath} to ${outputPath}: ${err}`))
      } else {
        resolve()
      }
    })
  })
}

function archivePathWithoutRoot (sourcePath, outputPath, removedFiles) {
  return fs.readdir(sourcePath, { withFileTypes: true })
    .then(dirents => {
      return new Promise((resolve, reject) => {
        const zip = new AdmZip()
        dirents.forEach(dirent => {
          if (dirent.isDirectory()) {
            zip.addLocalFolder(
              path.join(sourcePath, dirent.name),
              dirent.name
            )
          } else {
            zip.addLocalFile(
              path.join(sourcePath, dirent.name),
              '',
              dirent.name
            )
          }
        })

        removedFiles.forEach(removedFile => {
          zip.deleteFile(removedFile)
        })

        zip.writeZip(outputPath, (err) => {
          if (err) {
            reject(new Error(`[simple-archive] Error occured when archiving ${sourcePath} to ${outputPath}: ${err}`))
          } else {
            resolve()
          }
        })
      })
    })
}

module.exports.archivePathTo = function (sourcePath, outputPath, removedFiles) {
  removedFiles = removedFiles || []
  return archivePathWithoutRoot(sourcePath, outputPath, removedFiles)
}

module.exports.operateZip = function (zipFilePath, operations) {
  let zip
  return new Promise(resolve => {
    zip = new AdmZip(zipFilePath)
    resolve(zip)
  })
    .then(operations(zip))
    .then(() => {
      return new Promise((resolve, reject) => {
        zip.writeZip((err) => {
          if (err) {
            reject(new Error(`[simple-archive] Error occured when archiving ${sourcePath} to ${outputPath}: ${err}`))
          } else {
            resolve()
          }
        })
      })
    })
}

module.exports.readFilePromise = function (zip, fileEntry) {
  return new Promise((resolve, reject) => {
    zip.readFileAsync(fileEntry, (data, err) => {
      if (err) {
        reject(new Error(`[simple-archive] Error occured when reading entry ${fileEntry}: ${err}`))
      } else {
        resolve(data)
      }
    })
  })
}

module.exports.extractArchiveTo = function (archivePath, extractedPath) {
  return fs.ensureDir(extractedPath)
    .then(() => {
      return fs.stat(archivePath)
    })
    .then(stat => {
      return new Promise((resolve, reject) => {
        const zip = new AdmZip(archivePath)
        if (stat.size < 1000 && zip.getEntries().length === 0) { // because AdmZip.extractAllTo seems not calling callback for empty archives...
          resolve()
        } else {
          zip.extractAllToAsync(extractedPath, true, (err) => {
            if (err) {
              reject(new Error(`[simple-archive] Error occured when extracting ${archivePath} to ${extractedPath}: ${err}`))
            } else {
              setTimeout(() => resolve(), 50) // wait to avoid some problems
            }
          })
        }
      })
    })
}
