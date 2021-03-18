'use strict'

const { contextBridge, ipcRenderer, remote } = require('electron')

function invokeService (serviceName, methodName, extraArgs) {
  extraArgs = extraArgs || []
  extraArgs.unshift(methodName)
  return ipcRenderer.invoke(serviceName, extraArgs)
}

function genInvokeServiceFunc (serviceName) {
  return (methodName, ...extraArgs) => invokeService(serviceName, methodName, extraArgs)
}

contextBridge.exposeInMainWorld(
  'api', {
    // levelSchema: yamlOption,
    invokeStore: genInvokeServiceFunc('store'),
    invokeSelect: genInvokeServiceFunc('select'),
    invokeProgressService: genInvokeServiceFunc('progress'),
    invokeAppConfigService: genInvokeServiceFunc('app-config'),
    invokeLoad: genInvokeServiceFunc('load'), // loads using functions defined in LoaderPair (load-course-asset.js)
    invokeExecute: function (actionContent) {
      // let content = yaml.dump(action, this.levelSchema);
      // console.log('passing ' + content);
      return ipcRenderer.invoke(
        'execute',
        actionContent
      )
    },
    isDebug: (configName) => ipcRenderer.sendSync('is-debug', [configName])
  }
)

contextBridge.exposeInMainWorld(
  'electronRemote', {
    dialog: () => remote.dialog
  }
)
