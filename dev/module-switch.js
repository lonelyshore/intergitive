'use strict';

const fs = require('fs-extra');
const path = require('path');

let args = process.argv.slice(2);
let cachePath = path.resolve(__dirname, '../.module_cache');
let configPath = path.join(cachePath, '.config');
let modulePath = path.resolve(__dirname, '../node_modules');

wrapper(args)
.catch(err => {
    console.error(err);
})

function wrapper(args) {
    switch (args[0]) {
        case 'save':
            return saveModule(args[1], args[2]);
    
        case 'load':
            return loadModule(args[1], args[2]);
    
        case 'drop':
            if (args.length === 3) {
                return dropModuleEnvironment(args[1]);
            }
            else {
                return dropModule(args[1]);
            }
    
        case 'ls':
            return listModules();
    
        case 'which':
            return whichModule(args[1]);

        case 'versions':
            return versionsModule(args[1]);
    
        default:
            return new Promise.reject(new Error("Unexcepted arguments: " + args.join(', ')));
    }
}


function saveModule(moduleName, envName) {
    let storePath = path.join(cachePath, moduleName, envName);
    let sourcePath = path.join(modulePath, moduleName);
    return fs.emptyDir(storePath)
    .then(() => {
        return fs.copy(sourcePath, storePath);
    })
    .then(() => {
        return updateConfig(moduleName, ".system.");
    });
}

function loadModule(moduleName, envName) {
    let storePath = path.join(cachePath, moduleName, envName);
    let targetPath = path.join(modulePath, moduleName);
    return fs.emptyDir(targetPath)
    .then(() => {
        return fs.copy(storePath, targetPath);
    })
    .then(() => {
        return updateConfig(moduleName, envName);
    })
}

function dropModuleEnvironment(moduleName, envName) {
    let storePath = path.join(cachePath, moduleName, envName);
    return fs.remove(storePath)
    .then(() => {
        return fs.readFile(configPath)
        .then(configRaw => {
            let config = JSON.parse(configRaw);
            let currentEnv = config[moduleName];
            if (currentEnv && currentEnv === envName) {
                config[currentEnv] = '.system.';
            }

            return JSON.stringify(config);
        })
        .then(configRaw => {
            return fs.writeFile(configPath, configRaw);
        });
    });
}

function dropModule(moduleName) {
    return fs.remove(path.join(cachePath, moduleName))
    .then(() => {
        return fs.readFile(configPath)
        .then(configRaw => {
            let config = JSON.parse(configRaw);
            if (config[moduleName]) {
                delete config[moduleName];
            }

            return JSON.stringify(config);
        })
        .then(configRaw => {
            return fs.writeFile(configPath, configRaw);
        });
    })
}

function listModules() {
    return fs.readFile(configPath)
    .then(configRaw => {
        let config = JSON.parse(configRaw);
        Object.keys(config).forEach(moduleName => {
            printModuleVersion(moduleName, config);
        })
    })
}

function whichModule(moduleName) {
    return fs.readFile(configPath)
    .then(configRaw => {
        let config = JSON.parse(configRaw);
        printModuleVersion(moduleName, config);
    });
}

function versionsModule(moduleName) {
    let modulePath = path.join(cachePath, moduleName);
    return fs.exists(modulePath)
    .then(exists => {
        if (exists) {
            return fs.readdir(modulePath)
            .then(envNames => {
                envNames.forEach(envName => {
                    console.log(envName)
                });
            });
        }
        else {
            console.log('not installed');
        }
    })
    
}

function printModuleVersion(moduleName, config) {
    console.log(`${moduleName}: ${config[moduleName] || "not installed"}`);
}

function updateConfig(moduleName, envName) {
    return fs.readFile(configPath)
    .then(configRaw => {
        let config = JSON.parse(configRaw);
        config[moduleName] = envName;
        return JSON.stringify(config);
    })
    .then(configRaw => {
        fs.writeFile(configPath, configRaw);
    })
}