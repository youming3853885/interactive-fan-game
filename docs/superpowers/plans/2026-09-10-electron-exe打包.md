# Electron Windows EXE 打包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把整個遊戲 + Arduino 控制打包成一個 Windows portable `.exe`：離線、全螢幕 kiosk、開機自動連 Arduino（免選 COM），雙擊即玩；GitHub Pages 網頁版維持正常。

**Architecture:** Electron 外殼載入現有前端 build（相對路徑版）。主程序在 `select-serial-port` 用純函數 `pickArduinoPort` 自動挑 CH340，並自動授權 serial/media。前端在 Electron 環境自動連線。MoveNet 模型改從本機載入以支援離線。

**Tech Stack:** Electron、electron-builder、Vite、@tensorflow-models/pose-detection、Node 18+（global fetch）、vitest。

**參考 spec：** `docs/superpowers/specs/2026-09-10-electron-exe打包-design.md`

**慣例雷區（CLAUDE.md）：** 絕不 `git add -A`（家目錄有 .git，用明確路徑）；資產路徑用 `import.meta.env.BASE_URL`；改動全加法、不破壞 GitHub Pages 版。

---

## 檔案結構

| 檔案 | 責任 | 動作 |
|---|---|---|
| `tools/fetch-movenet.mjs` | 開發用：下載 MoveNet 模型到 public/models | 建立 |
| `public/models/movenet-singlepose-lightning/` | 本機模型檔（model.json + shards） | 產出 |
| `src/pose.js` | createDetector 加 `modelUrl` 指向本機模型 | 修改 |
| `electron/pick-port.cjs` | 純函數 `pickArduinoPort(portList)` 挑 CH340 | 建立 |
| `src/pick-port.test.js` | pickArduinoPort 單元測試 | 建立 |
| `electron/main.cjs` | Electron 主程序：kiosk 視窗、自動挑埠、權限 | 建立 |
| `electron/preload.cjs` | 注入 `window.__ELECTRON__ = true` | 建立 |
| `src/serial.js` | connectSerial 可接受既有 port（給自動連線） | 修改 |
| `src/main.js` | 抽出 doConnect；Electron 環境開機自動連線 | 修改 |
| `vite.config.js` | base 支援 ELECTRON 環境變數（`./`） | 修改 |
| `package.json` | electron 相依 + build/打包腳本 + electron-builder 設定 | 修改 |

---

### Task 1: 模型離線化（下載 MoveNet + pose.js 指向本機）

**Files:**
- Create: `tools/fetch-movenet.mjs`
- Modify: `src/pose.js:9-13`
- Produce: `public/models/movenet-singlepose-lightning/`

- [ ] **Step 1: 寫下載腳本**

建立 `tools/fetch-movenet.mjs`：

```javascript
// 下載 MoveNet SinglePose Lightning 模型到 public/models/movenet-singlepose-lightning/
// 供離線使用。Node 18+ 有內建 fetch。從專案根目錄執行：node tools/fetch-movenet.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/movenet/singlepose/lightning/4/';
const OUT = 'public/models/movenet-singlepose-lightning';

async function dl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`下載失敗 ${r.status}: ${url}`);
  return r;
}

await mkdir(OUT, { recursive: true });
const model = await (await dl(BASE + 'model.json')).json();
await writeFile(join(OUT, 'model.json'), JSON.stringify(model));
const shards = new Set();
for (const g of model.weightsManifest || []) for (const p of g.paths || []) shards.add(p);
for (const s of shards) {
  const buf = Buffer.from(await (await dl(BASE + s)).arrayBuffer());
  await writeFile(join(OUT, s), buf);
  console.log('✓', s, buf.length, 'bytes');
}
console.log('模型下載完成 →', OUT, '（', shards.size, 'shards）');
```

- [ ] **Step 2: 執行下載**

Run: `node tools/fetch-movenet.mjs`
Expected: 印出 `model.json` + 各 shard 的 `✓`，`public/models/movenet-singlepose-lightning/` 出現 `model.json` 與 `group1-shard*.bin`。
若 `model.json` 回 404：改用備援 BASE `https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/` 並在每個 URL 後加 `?tfjs-format=file`（改腳本的 `dl(BASE+'model.json'+'?tfjs-format=file')` 與 shard 同理），再跑一次。

- [ ] **Step 3: pose.js 指向本機模型**

`src/pose.js` 把 cfg（第 9-13 行）改成含 `modelUrl`：

```javascript
  const cfg = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    modelUrl: import.meta.env.BASE_URL + 'models/movenet-singlepose-lightning/model.json', // 本機模型(離線可用)
    enableSmoothing: true,   // 內建時間濾波降抖
    minPoseScore: 0.2,
  };
```

- [ ] **Step 4: 驗證（dev 模式離線載入）**

Run: `npm run dev`，用 Chrome 開，開 DevTools Network 面板，確認 MoveNet 從 `/models/movenet-singlepose-lightning/model.json`（本機）載入、**沒有**對 `tfhub.dev` / `storage.googleapis.com` 的請求，遊戲可正常偵測手。

- [ ] **Step 5: Commit**

```bash
git add tools/fetch-movenet.mjs src/pose.js public/models/movenet-singlepose-lightning
git commit -m "feat(離線): MoveNet 模型改本機載入(下載腳本+modelUrl)"
```

---

### Task 2: `pickArduinoPort` 純函數（挑 CH340）+ 測試（TDD）

**Files:**
- Create: `electron/pick-port.cjs`
- Test: `src/pick-port.test.js`

- [ ] **Step 1: 寫失敗測試**

建立 `src/pick-port.test.js`：

```javascript
import { describe, it, expect } from 'vitest';
import { pickArduinoPort } from '../electron/pick-port.cjs';

describe('pickArduinoPort（Electron 自動挑 Arduino 埠）', () => {
  it('優先挑 CH340（vendorId 十六進位 1a86）', () => {
    const list = [
      { portId: 'a', portName: 'COM1' },                      // 主機板內建、無 vendorId
      { portId: 'b', portName: 'COM25', vendorId: '1a86' },   // CH340
    ];
    expect(pickArduinoPort(list)).toBe('b');
  });
  it('CH340 的 vendorId 給十進位 6790 也認得', () => {
    const list = [{ portId: 'x', vendorId: '6790' }];
    expect(pickArduinoPort(list)).toBe('x');
  });
  it('沒 CH340 時挑第一個有 vendorId 的（排除無 vendorId 的 COM1）', () => {
    const list = [
      { portId: 'com1' },                                     // 無 vendorId
      { portId: 'ftdi', vendorId: '0403' },                   // FTDI USB 序列
    ];
    expect(pickArduinoPort(list)).toBe('ftdi');
  });
  it('全都沒 vendorId → 挑第一個', () => {
    expect(pickArduinoPort([{ portId: 'p1' }, { portId: 'p2' }])).toBe('p1');
  });
  it('空清單 → 回空字串', () => {
    expect(pickArduinoPort([])).toBe('');
    expect(pickArduinoPort(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/pick-port.test.js`
Expected: FAIL（找不到模組 / pickArduinoPort undefined）。

- [ ] **Step 3: 實作**

建立 `electron/pick-port.cjs`：

```javascript
// 從 Electron select-serial-port 的 portList 挑出要連的 Arduino 埠。
// Electron 的 vendorId 是字串，可能是十六進位("1a86")或十進位("6790")，兩種都比對。
function matchesVid(p, targetHex) {
  if (!p || p.vendorId == null || p.vendorId === '') return false;
  const s = String(p.vendorId).replace(/^0x/i, '');
  return parseInt(s, 16) === targetHex || parseInt(s, 10) === targetHex;
}
function hasVid(p) {
  return p && p.vendorId != null && p.vendorId !== '';
}

function pickArduinoPort(portList) {
  const ports = (portList || []).filter(Boolean);
  if (ports.length === 0) return '';
  const KNOWN = [0x1a86, 0x0403, 0x10c4, 0x2341]; // CH340 / FTDI / CP210x / Arduino
  let hit = ports.find((p) => matchesVid(p, 0x1a86));          // 1) CH340 優先
  if (!hit) hit = ports.find((p) => KNOWN.some((v) => matchesVid(p, v))); // 2) 其他常見 USB 轉序列
  if (!hit) hit = ports.find(hasVid);                          // 3) 任何有 USB vendorId 的(排除內建 COM1)
  if (!hit) hit = ports[0];                                    // 4) 退而求其次
  return hit && hit.portId ? hit.portId : '';
}

module.exports = { pickArduinoPort, matchesVid };
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/pick-port.test.js`
Expected: PASS（5 tests）。再跑 `npm test` 確認全綠。

- [ ] **Step 5: Commit**

```bash
git add electron/pick-port.cjs src/pick-port.test.js
git commit -m "feat(EXE): pickArduinoPort 純函數(自動挑CH340)+測試(TDD)"
```

---

### Task 3: Electron 主程序 + preload（kiosk 視窗、自動挑埠、權限）

**Files:**
- Create: `electron/main.cjs`, `electron/preload.cjs`
- Modify: `package.json`（加 electron 相依與 `main` 欄位）

- [ ] **Step 1: 裝 Electron**

Run: `npm install --save-dev electron@31 electron-builder@25 cross-env@7`
Expected: 安裝成功，`package.json` devDependencies 出現 electron / electron-builder / cross-env。

- [ ] **Step 2: 寫 preload**

建立 `electron/preload.cjs`：

```javascript
// 最小 preload：讓前端知道自己跑在 Electron 裡（要走開機自動連線）。
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('__ELECTRON__', true);
```

- [ ] **Step 3: 寫主程序**

建立 `electron/main.cjs`：

```javascript
const { app, BrowserWindow, session } = require('electron');
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
```

- [ ] **Step 4: package.json 指定 Electron 入口**

`package.json` 加 `"main"` 欄位（放在 `"private": true` 之後）：

```json
  "main": "electron/main.cjs",
```

- [ ] **Step 5: 驗證（暫時無法完整跑，先確認語法）**

Run: `node -e "require('./electron/pick-port.cjs'); console.log('cjs ok')"`
Expected: 印出 `cjs ok`（確認 cjs 模組能被 require、無語法錯）。完整 Electron 啟動在 Task 5 build 後驗證。

- [ ] **Step 6: Commit**

```bash
git add electron/main.cjs electron/preload.cjs package.json package-lock.json
git commit -m "feat(EXE): Electron 主程序+preload(kiosk視窗/自動挑埠/自動授權)"
```

---

### Task 4: 前端自動連線（serial.js 接受既有 port + main.js Electron 自動連）

**Files:**
- Modify: `src/serial.js`（connectSerial 簽名）
- Modify: `src/main.js`（抽出 doConnect、Electron 開機自動連）

- [ ] **Step 1: serial.js 讓 connectSerial 可接既有 port**

`src/serial.js` 把 `connectSerial` 開頭改成可接受既有 port（給自動連線用；不傳就照舊 requestPort）：

```javascript
export async function connectSerial(baud = 115200, existingPort = null) {
  if (!('serial' in navigator)) {
    throw new Error('此瀏覽器不支援 Web Serial，請用 Chrome/Edge');
  }
  const port = existingPort || await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  // 直接寫 port.writable，每筆加逾時：寫入卡住(埠沒在收/被佔用)就報錯，不無聲卡死
  const enc = new TextEncoder();
  const writer = port.writable.getWriter();
  return {
    name: 'USB',
    port,
    async send(line) {
      let timer;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('寫入逾時(埠沒在收/被佔用)')), 1200); });
      try { await Promise.race([writer.write(enc.encode(line)), timeout]); }
      finally { clearTimeout(timer); }
    },
  };
}
```

- [ ] **Step 2: main.js 抽出 doConnect 並在 Electron 自動連**

`src/main.js` 目前的連線 click handler（約 40-56 行）是：

```javascript
arduinoBtn.addEventListener('click', async () => {
  try {
    const usb = await connectSerial();
    sender = { name: 'USB', send: (line) => {
      arduinoStatus.textContent = line.trim();
      Promise.resolve(usb.send(line)).catch((err) => { arduinoStatus.textContent = '⚠ 送出失敗：' + (err && err.message || err); });
      return Promise.resolve();
    } };
    arduinoBtn.textContent = '已連接 (USB)'; arduinoBtn.disabled = true;
    arduinoStatus.textContent = '已連接，自動測試送出 T,1…';
    try { await usb.send('T,1\n'); arduinoStatus.textContent = '✓ 送出成功！Nano 內建燈應會亮(自檢結束後)'; }
    catch (err) { arduinoStatus.textContent = '✗ 送出失敗：' + (err && err.message || err); }
  } catch (e) { alert(e.message); }
});
```

把它整段換成「抽出 doConnect + 保留 click + Electron 自動連」：

```javascript
async function doConnect({ silent = false } = {}) {
  try {
    // 先用已授權的埠(免使用者手勢)；沒有才 requestPort(Electron 主程序會自動挑 CH340)
    let port = null;
    try { port = (await navigator.serial.getPorts())[0] || null; } catch { port = null; }
    if (!port) port = await navigator.serial.requestPort();
    const usb = await connectSerial(115200, port);
    sender = { name: 'USB', send: (line) => {
      arduinoStatus.textContent = line.trim();
      Promise.resolve(usb.send(line)).catch((err) => { arduinoStatus.textContent = '⚠ 送出失敗：' + (err && err.message || err); });
      return Promise.resolve();
    } };
    arduinoBtn.textContent = '已連接 (USB)'; arduinoBtn.disabled = true;
    arduinoStatus.textContent = '已連接，自動測試送出 T,1…';
    try { await usb.send('T,1\n'); arduinoStatus.textContent = '✓ 送出成功！Nano 內建燈應會亮(自檢結束後)'; }
    catch (err) { arduinoStatus.textContent = '✗ 送出失敗：' + (err && err.message || err); }
  } catch (e) { if (!silent) alert(e.message); }
}
arduinoBtn.addEventListener('click', () => doConnect());
```

- [ ] **Step 3: boot() 內 Electron 自動連線**

`src/main.js` 的 `boot()` 函式最後（在 `loop(pose);` 之前）加一段：Electron 環境自動連線（靜默，失敗就留手動按鈕）。找到 `boot()` 結尾的 `loop(pose);`，在它前面加：

```javascript
  if (window.__ELECTRON__) doConnect({ silent: true }); // Electron：開機自動連 Arduino
```

- [ ] **Step 4: build 驗證**

Run: `npm run build`
Expected: `✓ built`，零錯誤。（瀏覽器版行為不變：`window.__ELECTRON__` 未定義 → 不自動連。）

- [ ] **Step 5: Commit**

```bash
git add src/serial.js src/main.js
git commit -m "feat(EXE): 前端支援自動連線(connectSerial接既有port + Electron開機自動連)"
```

---

### Task 5: Vite base 切換 + Electron build + electron-builder 打包

**Files:**
- Modify: `vite.config.js`, `package.json`

- [ ] **Step 1: vite base 支援 ELECTRON**

`src/../vite.config.js` 改成三態 base：

```javascript
import { defineConfig } from 'vite';

// Electron 用相對路徑 './'(file 協定)；GitHub Pages 用子路徑；本機 dev 用 '/'。
export default defineConfig({
  base: process.env.ELECTRON ? './' : (process.env.GITHUB_ACTIONS ? '/interactive-fan-game/' : '/'),
});
```

- [ ] **Step 2: package.json 加打包腳本與設定**

`package.json` 的 `scripts` 加：

```json
    "build:electron": "cross-env ELECTRON=1 vite build --outDir dist-electron",
    "start:electron": "cross-env ELECTRON=1 vite build --outDir dist-electron && electron .",
    "dist:exe": "cross-env ELECTRON=1 vite build --outDir dist-electron && electron-builder --win portable",
```

並在 `package.json` 最外層加 electron-builder 設定區塊：

```json
  "build": {
    "appId": "com.longmen.circleduel",
    "productName": "畫圈對決",
    "directories": { "output": "release" },
    "files": ["dist-electron/**/*", "electron/**/*"],
    "asar": true,
    "win": { "target": "portable" }
  },
```

- [ ] **Step 3: 忽略產物目錄**

`.gitignore` 加（若無則建立/附加）：

```
dist-electron/
release/
```

Run: `git status --porcelain .gitignore` 確認變更。

- [ ] **Step 4: 先跑 Electron 開發啟動驗證（不打包）**

Run: `npm run start:electron`
Expected: 全螢幕 kiosk 視窗開起來、遊戲載入（LOADING→選歌）；插著 Arduino 時**自動連上**（設定裡「已連接 (USB)」、綠字 `✓ 送出成功`）。按 `Ctrl+Shift+Q` 可離開。
（若視窗白畫面：多半是資產路徑，確認 base `./` 生效、`dist-electron/index.html` 內資源為相對路徑。）

- [ ] **Step 5: 打包 exe**

Run: `npm run dist:exe`
Expected: `release/` 產出 `畫圈對決 <version>.exe`（portable 單檔，約 150-250MB）。

- [ ] **Step 6: Commit**

```bash
git add vite.config.js package.json package-lock.json .gitignore
git commit -m "feat(EXE): vite base 切換 + electron-builder 打包 portable exe"
```

---

### Task 6: 打包產物實機驗證 + 回歸網頁版

**Files:** 無（驗證）

- [ ] **Step 1: 雙擊 exe 驗證**

雙擊 `release/畫圈對決 *.exe`：
1. 全螢幕開啟、能進 LOADING → 選歌。
2. 插 Arduino → **自動連上**（設定內顯示已連接、綠字 ✓、Nano 內建燈自檢後亮）。
3. 硬體測試：馬達 PWM 64/128 會轉、燈條開會亮。
4. 三種時長模式、單人/雙人畫圈計分正常。
5. **拔掉網路線**再開一次 → 仍可玩（模型走本機、MV 已打包）。
6. `Ctrl+Shift+Q` 可離開。

- [ ] **Step 2: 回歸網頁版**

Run: `npm test && npm run build`
Expected: 測試全綠、`✓ built`。（`base` 在無 ELECTRON 時仍是 `/`；GitHub Pages 由 `GITHUB_ACTIONS` 走子路徑，未受影響。）
push 到 main 後，線上網頁版仍正常（手動連線、模型改本機載入後線上也可用）。

- [ ] **Step 3: 收尾**

全部通過即完成。exe 在 `release/`，可直接複製到展場電腦雙擊執行。

---

## Self-Review

**Spec coverage：**
- Electron 外殼 kiosk 全螢幕 → Task 3 ✅
- 自動連 Arduino（pickArduinoPort CH340 + 權限 + 前端自動連）→ Task 2/3/4 ✅
- 離線模型 → Task 1 ✅
- base './' + electron-builder portable exe → Task 5 ✅
- 不破壞網頁版（base 三態、__ELECTRON__ 條件）→ Task 4/5/6 ✅
- 測試：pickArduinoPort 單測 + 實機驗證 → Task 2/5/6 ✅
- 明確不做（開機自動啟動/自動更新/跨平台）→ 未列入任務 ✅

**Placeholder scan：** 無 TBD/TODO；每個 code step 均含完整程式碼與確切指令。

**Type/名稱一致性：** `pickArduinoPort(portList)→portId字串` 在 Task 2 定義、Task 3 主程序引用、Task 2 測試一致；`window.__ELECTRON__` 在 Task 3 preload 注入、Task 4 boot 判斷一致；`connectSerial(baud, existingPort)` 在 Task 4 Step1 定義、Step2 doConnect 呼叫一致；`dist-electron` 輸出在 Task 3 loadFile、Task 5 build:electron/files 三處一致；`modelUrl` 路徑 `models/movenet-singlepose-lightning/model.json` 在 Task 1 下載目錄與 pose.js 一致。
