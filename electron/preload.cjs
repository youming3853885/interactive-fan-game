// 最小 preload：讓前端知道自己跑在 Electron 裡（要走開機自動連線）。
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('__ELECTRON__', true);
