const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const https = require('https');
const path = require('path');

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

const REPO_OWNER = 'siterator67-cmyk';
const REPO_NAME = 'WorldChat';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WorldChat',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1b2838',
    show: false,
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);

  win.once('ready-to-show', () => {
    win.show();
    checkForUpdates(win);
  });
}

function checkForUpdates(win) {
  const currentVersion = app.getVersion();

  const options = {
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    headers: { 'User-Agent': 'WorldChat-Updater' },
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latestVersion = (release.tag_name || '').replace(/^v/, '');
        if (!latestVersion) return;

        if (isNewer(latestVersion, currentVersion)) {
          const exe = (release.assets || []).find(a => a.name.endsWith('.exe') && !a.name.endsWith('.blockmap'));
          const downloadUrl = exe
            ? exe.browser_download_url
            : release.html_url;

          dialog.showMessageBox(win, {
            type: 'info',
            title: 'Update available',
            message: `A new version of WorldChat is available!\n\nCurrent: v${currentVersion}\nNew: v${latestVersion}`,
            buttons: ['Download update', 'Later'],
            defaultId: 0,
          }).then((result) => {
            if (result.response === 0) {
              shell.openExternal(downloadUrl);
            }
          });
        }
      } catch (e) {}
    });
  }).on('error', () => {});
}

function isNewer(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
