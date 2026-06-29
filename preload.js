const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const tokenPath = path.join(require('os').homedir(), '.worldchat_token');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.send('open-external', url),
  saveToken: (token) => { try { fs.writeFileSync(tokenPath, token, 'utf8'); } catch(e) {} },
  loadToken: () => { try { return fs.readFileSync(tokenPath, 'utf8'); } catch(e) { return null; } },
  removeToken: () => { try { fs.unlinkSync(tokenPath); } catch(e) {} },
});
