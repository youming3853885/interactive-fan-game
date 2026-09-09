const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pickArduinoPort } = require('./pick-port.cjs');

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#05060d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // 遊戲需要攝影機/WebGL/Web Serial，維持預設安全設定即可
    },
  });

  const ses = win.webContents.session;
  // 自動挑 Arduino 埠：不跳選埠視窗
  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    callback(pickArduinoPort(portList));
  });
  // 自動授權序列裝置 + 攝影機
  ses.setDevicePermissionHandler(() => true);
  ses.setPermissionCheckHandler(() => true);
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(true));

  win.loadFile(path.join(__dirname, '..', 'dist-electron', 'index.html'));

  // 離開：Ctrl+Shift+Q（kiosk 下鎖住一般關閉，留一個隱藏退出鍵）
  win.webContents.on('before-input-event', (e, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'q') app.quit();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
