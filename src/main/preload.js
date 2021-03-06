'use strict';

const { contextBridge, ipcRenderer, remote } = require('electron');

const yaml = require('js-yaml');
const stepConfigs = require('../common/config-step');
const actionConfigs = require('../common/config-action');
const courseConfig = require('../common/config-course');
const { LEVEL_CONFIG_SCHEMA } = require('../common/level-config-schema');
const { COURSE_CONFIG_SCHEMA } = require('../common/course-config-schema');
const yamlOption = { schema: LEVEL_CONFIG_SCHEMA };

function invokeService(serviceName, methodName, extraArgs) {
    extraArgs = extraArgs || [];
    extraArgs.unshift(methodName);
    return ipcRenderer.invoke(serviceName, extraArgs);
}

function genInvokeServiceFunc(serviceName) {
    return (methodName, ...extraArgs) => invokeService(serviceName, methodName, extraArgs);
}

contextBridge.exposeInMainWorld(
    'api', {
        //levelSchema: yamlOption,
        invokeStore: genInvokeServiceFunc('store'),
        invokeSelect: genInvokeServiceFunc('select'),
        invokeProgressService: genInvokeServiceFunc('progress'),
        invokeLoad: genInvokeServiceFunc('load'), // loads using functions defined in LoaderPair (load-course-asset.js)
        invokeExecute: function(actionContent) {
            //let content = yaml.dump(action, this.levelSchema);
            //console.log('passing ' + content);
            return ipcRenderer.invoke(
                'execute',
                actionContent
            );
        },
        getConfig: (configName) => ipcRenderer.sendSync('get-config', [configName]),
    }
);

contextBridge.exposeInMainWorld(
    'dependencies', {
        // stepConfigs: stepConfigs,
        // actionConfigs: actionConfigs,
        // courseConfig: courseConfig,
        // courseSchema: COURSE_CONFIG_SCHEMA,
        // levelSchema: LEVEL_CONFIG_SCHEMA,
    }
);

contextBridge.exposeInMainWorld(
    'electronRemote', {
        dialog: () => remote.dialog,
    }
)
