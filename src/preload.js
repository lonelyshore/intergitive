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

function invokeService(serviceName, methodName, extraArgs) {
    extraArgs = extraArgs || [];
    extraArgs.unshift(methodName);
    return ipcRenderer.invoke(serviceName, extraArgs);
}

function genInvokeServiceFunc(serviceName) {
    return (methodName, ...extraArgs) => invokeService(serviceName, methodName, extraArgs);
}

window.api = {
    invokeStore: genInvokeServiceFunc('store'),
    invokeProgressService: genInvokeServiceFunc('progress'),
    load: genInvokeServiceFunc('load'), // loads using functions defined in LoaderPair (load-course-asset.js)
    createNewState: () => new state.State(),
}
