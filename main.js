// main.js
const { app, BrowserWindow, shell } = require('electron');
const express = require('express');
const path = require('path');

let mainWindow;
const port = 3000;

function createExpressServer() {
  const serverApp = express();

  // /callback handles the redirect from the identity provider.
  serverApp.get('/callback', (req, res) => {
    // Build the full callback URL (including query parameters)
    const callbackUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    console.log('Received OIDC callback:', callbackUrl);

    // Respond with a simple page instructing the user to close the browser.
    res.send('<html><body><h2>Authentication complete. You can close this window.</h2></body></html>');

    // Send the callback URL to the renderer process via IPC.
    if (mainWindow) {
      mainWindow.webContents.send('oidc-callback', callbackUrl);
    }
  });

  serverApp.listen(port, () => {
    console.log(`Express server listening on http://localhost:${port}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800, // Increased vertical size
    webPreferences: {
      // For simplicity, node integration is enabled.
      // In production, consider using preload scripts and contextIsolation.
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the UI.
  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  // Intercept navigations so external URLs open in the system browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      console.log('Opening external URL:', url);
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createExpressServer();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
