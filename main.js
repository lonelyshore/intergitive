"use strict";

const { app, BrowserWindow } = require('electron')

function createWindow () {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 1000,
    height: 1000,
    webPreferences: {
      nodeIntegration: true
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html')
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

