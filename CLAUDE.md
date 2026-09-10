# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

影像辨識「畫圈對決」節奏遊戲：純瀏覽器（Vite + vanilla JS），用攝影機 + TF.js MoveNet 偵測玩家手臂畫圈，透過 Web Serial 驅動 Arduino 風機/WS2812。部署在 GitHub Pages。全繁體中文（台灣）UI。

## Commands

```bash
npm install
npm run dev                       # http://localhost:5173（要允許攝影機，用 Chrome/Edge）
npm test                          # vitest run，跑全部單元測試
npx vitest run src/score.test.js  # 單一測試檔
npx vitest run -t "整圈"          # 依測試名稱過濾
npm run build                     # vite build → dist/（部署前務必零錯誤）
npm run preview                   # 預覽 build 產物
```

**部署**：push 到 `main` → GitHub Actions 自動 build + 發佈到 GitHub Pages（`.github/workflows/deploy.yml`）。線上網址 `https://youming3853885.github.io/interactive-fan-game/`。

## Architecture

**DOM 分層**（`index.html`，靠 z-index 疊）：`#mv`(MV 影片,z0) → `#cam`(攝影機,z1,CSS `scaleX(-1)` 鏡像) → `#overlay`(遊戲繪製 canvas,z2) → `#hud`(DOM 疊層如按鈕/彈窗/設定,z3)。遊玩時攝影機 `opacity=0` 隱藏、只留 MV + canvas 繪製的手/UI。

**`src/main.js` = 唯一協調者**：一個 `requestAnimationFrame` 迴圈 + phase 狀態機（`loading → select → ready → playing → victory`）。每幀：偵測手 → 更新純函數狀態 → 呼叫 `ui.render()` 畫 canvas → 送 serial 指令。所有跨 phase 的可變狀態（分數、chart、bpm、settings…）是 `main.js` 模組層變數。**注意作用域**：`loop()` 是頂層函式，若它引用只宣告在 `boot()` 內的變數會 ReferenceError → playing 首幀凍結（歷史上踩過 `settings`、`rotL/rotR` 兩次）。

**純函數核心（有單元測試，`*.test.js`）**——邏輯都放這、可獨立驗證：
- `motion.js` 畫圈偵測＝**動態圓心追蹤**（`circleStep`：手腕軌跡移動平均當圓心 → 角速度 omega，含半徑門檻＋尖刺防護）＋`createArmPicker` 手臂鎖定（防左右手跳換）。⚠️ 勿改回「手腕相對肩膀」角度法——那只量得到掄大圈，胸前畫圈會失效
- `chart.js` 依 BPM 生成 正轉F/反轉R/休息S 段落表 + `segmentAt`
- `score.js` **每轉完一整圈才給分**：`revStep`(累積角度到 2π=一圈) → `judgeRev`(速率契合度 PERFECT/GREAT/GOOD) → `revScore`(固定分×`comboMultiplier`)；`gradeFor` 單人評級
- `ready.js` 準備方塊/持握、`protocol.js` serial 指令格式、`settings.js` localStorage、`tracks.js` 曲目、`select-screen.js` 純工具

**薄轉接層（無單元測試，靠 build + 實機驗證）**：`pose.js`(TF.js MoveNet)、`serial.js`(Web Serial，無裝置時 sim)、`music.js`(MV `<video>` 控制)、`ui.js`(canvas 全部繪製)、`sfx.js`(WebAudio 合成 + TTS 語音)、`lights.js`/`loading.js`/`mode-modal.js`/`settings-panel.js`(DOM 元件)。

**改邏輯先動純函數 + 測試；`ui.js`/`pose.js`/`main.js` 是轉接，靠 `npm run build` + 人工實測。**

## 專案特定慣例與雷區

- **偵測策略（勿改壞）**：`pose.js` 用**單一共用 SINGLEPOSE_LIGHTNING** 偵測器。單人 = `readFull()` 吃整張；雙人 = `readHalf('A'/'B')` 左右半張各偵測，**保證每邊各抓到一位玩家**。⚠️ 不要改回 MULTIPOSE（會漏抓第二人）；不要建多個偵測器實例（會 lag）。必須 `await tf.setBackend('webgl'); await tf.ready()` 後才建偵測器。
- **座標鏡像**：畫面鏡像顯示，pose 座標要經 `toCanvas(pt,side)`（半張）或 `toCanvasFull(pt)`（整張）換算，A=螢幕左=原始右半、B=螢幕右=原始左半。
- **手的呈現**：遊玩時手不跟真實 xy（會抖），改鎖在（隱藏的）圓軌道上、依累積角度 `markerAngle` 滑動 + 流星尾。
- **資產路徑**：一律用 `import.meta.env.BASE_URL + 'xxx'`（GitHub Pages 有 `/interactive-fan-game/` 子路徑）。圖片放 `public/`（bars 能量條/judge 判定字/modes 模式卡/mv/covers），大圖用 WebP/JPG（載入已優化過）。
- **UI 規範**：全繁中；**除了手 🖐 之外全遊戲不放 emoji**；校名固定「澎湖縣龍門國小」；serial 協定 `A,F,180,45;B,R,200,60\n`（頻道,方向,PWM,能量）。
- **git**：**絕不 `git add -A`**（家目錄有 `.git`，會掃整個家目錄爆炸）——一律用明確檔案路徑 add。commit 只在被要求時。
- **視覺素材**：可用 `codex-image` skill 生插畫/普普風判定字（生後複製進 `public/`，深色底要去背）。mockup 放 `mockups/`，可用 playwright 起 `python -m http.server` 截圖自驗。

## 硬體 / 韌體

Arduino UNO + L298N 雙 DC 風機 + 2×WS2812B，韌體在 `firmware/interactive_fan/`。接腳/協定/電源注意事項見 `README.md`。**未實機驗證**（攝影機/串口需在實體 rig 測）。

設計/計畫文件在 `docs/superpowers/`。
