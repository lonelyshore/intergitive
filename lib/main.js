"use strict";

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mainStore = require('./main-store');
const progress = require('./progress-service');
const assert = require('assert');
const { typeCheck } = require('./utility');

function createWindow () {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      preload: path.resolve(__dirname, '../src/preload.js')
    }
  });

  // and load the index.html of the app.
  win.loadFile('../index.html');
  win.webContents.openDevTools();

  win.on('closed', () => {
    win = null;
  })
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // 在 macOS 中，一般會讓應用程式及選單列繼續留著，
  // 除非使用者按了 Cmd + Q 確定終止它們
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Invoke store methods and returns with store's new state
ipcMain.handle('store', async (event, arg) => {
  let funcName = arg.shift();

  let result = await mainStore[funcName](...arg);
  return { state: null, extras: result };
});

// Invoke functions of store and only return its original return value
ipcMain.handle('select', async (event, arg) => {
  let funcName = arg.shift();

  return mainStore[funcName](...arg);
});

ipcMain.handle('progress', async (event, arg) => {
  let funcName = arg.shift();
  return progress[funcName](...arg);
});

// loads from LoaderPair
ipcMain.handle('load', async (event, arg) => {
  let funcName = arg.shift();
  return mainStore.loaderPair[funcName](...arg)
  .catch(err => {
    console.error(`Failed to load using loaderPair[${funcName}](${arg.join(', ')}) with following error:`);
    console.error(err);

    return '';
  });
});

ipcMain.handle('execute', async (event, arg) => {
  assert(typeCheck.isString(arg));
  console.log('received: ' + arg);
  
  return mainStore.execute(arg);
})
