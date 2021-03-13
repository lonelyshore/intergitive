'use strict';

const fs = require('fs-extra');
const path = require('path');
const { ApplicationConfig } = require('../common/config-app');


const configName = 'app-config.json';

function createDefaultConfig(){
    return new ApplicationConfig(
        'zh-Hant',
        'git-extensions'
    );
}

class AppConfigService {

    constructor(configDirName) {
        this.configDirName = configDirName;
    }

    get configurationPath() {
        return path.join(this.configDirName, configName);
    }

    loadConfiguration() {

        return fs.readFile(this.configurationPath)
        .then(content => {
            let obj = JSON.parse(content);
            Object.setPrototypeOf(obj, ApplicationConfig);
            return obj
        })
        .catch(err => {
            let defaultConfig = createDefaultConfig();

            return this.saveConfiguration(defaultConfig)
            .then(() => defaultConfig);
        });
    }

    /**
     * This method is for development only.
     * @returns {ApplicationConfig}
     */
    loadConfigurationSync() {

        let obj;
        try {
            let content = fs.readFileSync(this.configurationPath);
            obj = JSON.parse(content);
            Object.setPrototypeOf(obj, ApplicationConfig);
        }
        catch(error) {
            obj = createDefaultConfig();
        }
        
        return obj;
    }

    /**
     * 
     * @param {ApplicationConfig} config The configuration to be serialized
     */
    saveConfiguration(config) {
        return fs.writeFile(
            this.configurationPath,
            JSON.stringify(config)
        );
    }
}

module.exports.AppConfigService = AppConfigService;