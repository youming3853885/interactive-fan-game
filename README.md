# 影像辨識畫圈對決遊戲 (interactive-fan-game)

攝影機辨識兩名玩家手臂畫圈，方向做對才累積能量，透過 Web Serial 驅動 Arduino UNO 上的兩顆 DC 風機（正反轉）與兩條 WS2812 燈帶能量條，先集滿者勝。

## 玩法

- 畫面左右各一名玩家（左右切半辨識），各自顯示隨機方向指令 ↻/↺。
- 手臂畫圈方向**符合指令** → 能量上升、手上噴特效；做錯或停手 → 能量緩降。
- 風機永遠跟玩家真實手勢正反轉；燈帶＝實體能量條。
- 誰先集滿 100 → 勝利，4 秒後重來。

## 執行（純瀏覽器，Chrome/Edge）

```bash
npm install
npm run dev        # 開 http://localhost:5173，允許攝影機
npm test           # 跑核心邏輯單元測試
```

不接 Arduino 也能玩（sim 模式：畫面角落會印出 serial 指令）。要接硬體時按畫面上方「連接 Arduino」選 USB 埠。

## 硬體

| 元件 | 用途 |
|---|---|
| Arduino UNO | 收指令、驅動馬達與燈帶 |
| L298N 雙 H 橋 | 驅動 2 顆 DC 風機，正反轉 + PWM 調速 |
| 2× DC 馬達風機 | 跟玩家手勢同步正反轉 |
| 2× WS2812B 燈帶 | 實體能量條 |

**接腳**：`ENA=3 IN1=2 IN2=4`、`ENB=5 IN3=7 IN4=8`、燈帶 A/B data = `6`/`9`。
**電源**：馬達 12V、燈帶 5V（依燈數算安培），皆與 UNO 共地。詳見 `firmware/interactive_fan/`。

⚠️ 馬達啟停會拉低電壓干擾 UNO → 獨立電源 + 共地 + 濾波電容；WS2812 電流隨燈數上升，別吃 USB 5V。

## 通訊協定

網頁 → Arduino，一行 ASCII：`A,F,180,45;B,R,200,60\n`
（頻道,方向 F/R/S,PWM 0-255,能量 0-100）

## 文件

- 設計：`docs/superpowers/specs/2026-09-05-影像辨識畫圈對決-design.md`
- 實作計畫：`docs/superpowers/plans/2026-09-05-影像辨識畫圈對決.md`
