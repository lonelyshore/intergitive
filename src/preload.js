'use strict';

console.warn('preload');

const { contextBridge, ipcRenderer } = require('electron');

console.warn('preload - 1');

const state = require('../lib/state');

console.warn('preload - 2');

//const paths = require('./paths');

console.warn('preload - 3');

// contextBridge.exposeInMainWorld(
//     'api', {
//         getStore: () => store,
//         getPaths: () => paths,
//     }
// );

window.api = {
    invokeStore: (methodName, ...extraArgs) => {
        extraArgs = extraArgs || [];
        extraArgs.unshift(methodName);
        return ipcRenderer.invoke('store', extraArgs);
    },
    createNewState: () => new state.State(),
}
