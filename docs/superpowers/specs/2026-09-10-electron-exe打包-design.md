# 打包成 Windows 單機 EXE（Electron）設計文件

**日期**：2026-09-10
**狀態**：設計已確認，待寫實作計畫

## 目標

把整個遊戲 + Arduino 控制打包成**一個 Windows `.exe`**：展場單機、**離線**、全螢幕 kiosk、**開機自動連 Arduino（免選埠）**，雙擊即玩。GitHub Pages 網頁版維持正常運作。

## 決策摘要

- 平台：**Windows only**（展場單機）。
- 外殼：**Electron**（重用現有前端 build，Web Serial / 攝影機 / TF.js / WebAudio 全部照用）。
- 連線：**自動連 Arduino**（主程序認 CH340 自動挑埠，前端啟動自動連），徹底免手動選 COM。
- 啟動：**手動雙擊 exe**（不做開機自動啟動）。
- 產物：**electron-builder → portable 單一 .exe**（免安裝）。
- 大小：~200MB（內含 Chromium，展場單機可接受）。
- 原則：所有改動是**加法**，不破壞 GitHub Pages 網頁版。

## 元件

### ① Electron 外殼（新增 `electron/`）

- `electron/main.cjs`（主程序）：
  - 建立 `BrowserWindow`：`fullscreen: true`、`kiosk: true`、`autoHideMenuBar: true`、`webPreferences: { preload }`。
  - 載入打包好的前端（見 ④ 載入方式）。
  - 註冊序列埠自動挑選 + 權限（見 ②）。
  - 離開：保留 `Ctrl+Shift+Q`（或 Alt+F4）關閉；kiosk 下鎖住一般關閉手勢。
- `electron/preload.cjs`：最小橋接，注入一個旗標 `window.__ELECTRON__ = true`（讓前端知道自己在 Electron 裡、要走自動連線）。

### ② 自動連 Arduino（核心）

主程序 `electron/main.cjs`：
- `session.defaultSession.on('select-serial-port', (event, portList, webContents, callback) => {...})`：
  - 從 `portList` 挑 **vendorId === 0x1A86（CH340）** 的埠；找不到就挑第一個有 vendorId 的 USB 序列埠；再找不到 `callback('')`。
- `session.defaultSession.setDevicePermissionHandler(() => true)`：自動授權序列裝置。
- `session.defaultSession.setPermissionCheckHandler(() => true)` 與 `setPermissionRequestHandler((wc, perm, cb) => cb(true))`：自動授權 `serial`、`media`（攝影機）。

前端（`src/main.js`）：
- 啟動時若 `window.__ELECTRON__`，**自動呼叫連線流程**（等同現在按「連接 Arduino」）：先試 `navigator.serial.getPorts()` 取已授權埠；沒有就 `requestPort()`（主程序會自動挑 CH340，不跳視窗）。連上後跑現有的自動測試。
- **瀏覽器版維持手動按鈕**（`window.__ELECTRON__` 未定義 → 行為不變）。

### ③ 離線化模型（必要）

- 下載 **MoveNet SINGLEPOSE_LIGHTNING** 模型檔（`model.json` + `*.bin`）到 `public/models/movenet-singlepose-lightning/`。
- `src/pose.js` 的 `createDetector` cfg 加：
  `modelUrl: import.meta.env.BASE_URL + 'models/movenet-singlepose-lightning/model.json'`。
- 這樣**離線可跑**，且網頁版也一起受益（不再依賴 Google CDN、載入更快）。

### ④ 前端 build 與載入方式

- Electron 載入需要**相對資產路徑**（file 協定），與 GitHub Pages 的 `/interactive-fan-game/` 子路徑衝突。
- 解法：新增 **Electron 專用 build**，用 `base: './'`。
  - `package.json` 加腳本 `build:electron`（設環境變數或用獨立 vite 設定，`base` 依目標切換）。
  - `vite.config.js` 讓 `base` 可由環境變數控制（如 `process.env.ELECTRON ? './' : '/interactive-fan-game/'`）。
- 主程序用 `win.loadFile('dist-electron/index.html')` 載入（相對路徑資產可正常解析）。
  - Web Serial / getUserMedia 在 Electron 的 file 頁面屬於受信任情境，配合 ② 的權限處理即可運作。

### ⑤ 打包（electron-builder）

- `package.json` 加 electron-builder 設定：
  - `build.win.target: "portable"` → 產出單一可攜 `.exe`。
  - `build.files`：含 `dist-electron/**`、`electron/**`。
  - `build.asar: true`（打包壓縮）。
- 腳本 `dist:exe`：先 `build:electron`（前端）再 `electron-builder --win portable`。
- 產物在 `release/` 下的 `畫圈對決.exe`（單檔）。

## 測試

- **純函數**：本任務主要是打包與外殼，核心遊戲純函數不動；不新增單元測試。
- **主程序挑埠邏輯**：抽成一個純函數 `pickArduinoPort(portList)`（回傳要選的 portId 或 ''），**寫一個小的 Node 單元測試**（給假 portList 陣列，驗證優先挑 0x1A86、退而求其次挑有 vendorId 的、都沒有回 ''）。
- **實機驗證**（無法自動化，人工）：
  1. `npm run dist:exe` 產出 exe，雙擊能開、全螢幕。
  2. 插 Arduino → 開 exe → **自動連上**（設定裡顯示已連接、綠字自動測試 ✓、內建燈亮）。
  3. 三種時長模式、單雙人、硬體測試（馬達 PWM/燈條）都正常。
  4. **拔網路線**確認離線仍可玩（模型走本機）。
  5. GitHub Pages 網頁版 `npm run build` + 部署後仍正常（base 路徑、手動連線未壞）。

## 風險與取捨

- **Web Serial in Electron**：需靠主程序 `select-serial-port` + 權限 handler；已是 Electron 標準做法。
- **模型檔大小**：MoveNet Lightning 約數 MB，打包進 exe 無妨。
- **檔案 ~200MB**：Chromium 內含，展場單機可接受（已與使用者確認）。
- **file 協定安全情境**：靠 ② 的權限 handler 放行 serial/media；若遇阻，退路是主程序內起一個 `127.0.0.1` 靜態伺服器載入（localhost 為安全情境）。列為備案，不預先實作。
- **YAGNI**：不做開機自動啟動、不做自動更新、不做 Mac/Linux、不做安裝式 installer（用 portable 單檔）。

## 不做（明確排除）

- 開機自動啟動（使用者選手動雙擊）。
- 自動更新 / 程式碼簽章。
- 跨平台（僅 Windows）。
- Tauri / NW.js 路線（選定 Electron）。
