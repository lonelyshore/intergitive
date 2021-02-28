'use strict';

console.warn('preload');

const { contextBridge, ipcRenderer } = require('electron');

console.warn('preload - 1');

const state = require('../lib/state');

console.warn('preload - 2');

const yaml = require('js-yaml');
const stepConfigs = require('../lib/config-step');
const actionConfigs = require('../lib/config-action');
const courseConfig = require('../lib/config-course');
const { LEVEL_CONFIG_SCHEMA } = require('../lib/level-config-schema');
const { COURSE_CONFIG_SCHEMA } = require('../lib/course-config-schema');
const yamlOption = { schema: LEVEL_CONFIG_SCHEMA };

console.warn('preload - 3');

// contextBridge.exposeInMainWorld(
//     'api', {
//         getStore: () => store,
//         getPaths: () => paths,
//     }
// );

function invokeService(serviceName, methodName, extraArgs) {
    extraArgs = extraArgs || [];
    extraArgs.unshift(methodName);
    return ipcRenderer.invoke(serviceName, extraArgs);
}

function genInvokeServiceFunc(serviceName) {
    return (methodName, ...extraArgs) => invokeService(serviceName, methodName, extraArgs);
}

window.api = {
    levelSchema: null,
    invokeStore: genInvokeServiceFunc('store'),
    invokeSelect: genInvokeServiceFunc('select'),
    invokeProgressService: genInvokeServiceFunc('progress'),
    invokeLoad: genInvokeServiceFunc('load'), // loads using functions defined in LoaderPair (load-course-asset.js)
    invokeExecute: function(action) {
        let content = yaml.dump(action, this.levelSchema);
        //console.log('passing ' + content);
        return ipcRenderer.invoke(
            'execute',
            content
        );
    },
    createNewState: () => new state.State(),
};
window.dependencies = {
    stepConfigs: stepConfigs,
    actionConfigs: actionConfigs,
    courseConfig: courseConfig,
    courseSchema: COURSE_CONFIG_SCHEMA,
    levelSchema: LEVEL_CONFIG_SCHEMA,
}
