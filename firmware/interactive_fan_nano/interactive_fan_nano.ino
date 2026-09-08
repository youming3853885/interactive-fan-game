// 畫圈對決 — Arduino Nano 韌體（MOSFET 驅動版，配 775 風機 + 12V 電源）
// 收 Web Serial 一行指令：A,F,180,45;B,R,200,60\n
//   每個頻道 = 頻道id,方向(F/R/S),PWM(0..255),能量(0..100)
//   A = 1P（螢幕左）、B = 2P（螢幕右）。
//   風機只往前吹 → 方向 F/R 都當「轉」，S 當「停」；用 MOSFET 純 PWM 調速，不需 H 橋。
//
// ---- Arduino Nano 接腳（MOSFET 模組 ×2） ----
//   D3 (PWM~) → MOSFET 模組 A 的 PWM/SIG   風機 1P 轉速
//   D5 (PWM~) → MOSFET 模組 B 的 PWM/SIG   風機 2P 轉速
//   D7        → WS2812 燈條 1P 資料 DIN（串 330Ω 更穩）
//   D8        → WS2812 燈條 2P 資料 DIN
//   （燈資料是數位序列，不必用 PWM 腳；D7~D12 任兩隻皆可，這裡用 D7/D8）
//   GND       → 兩個 MOSFET 模組訊號 GND + 全系統共地
//   USB       → 電腦（供電 + Web Serial）
//   ※ MOSFET 大電流側：12V+/GND 進、馬達兩條接輸出；馬達並續流二極體(SS34)壓火花。
//   ※ Arduino 只出 PWM+GND，不碰 12V。馬達 12V、燈 5V 都走外部電源。
//   ※ 兩顆 775 啟動湧浪大：12V 端並 2200~4700µF/25V 電容；本韌體對測試開關做軟啟動。

#include <FastLED.h>

#define FAN_A_PIN 3           // MOSFET A（風機 1P）
#define FAN_B_PIN 5           // MOSFET B（風機 2P）
#define LED_A_PIN 7
#define LED_B_PIN 8
#define NUM_LEDS 30           // 依實際燈帶顆數調整
#define RAMP_STEP 6           // 軟啟動：每步 PWM 增量（越小越緩）
#define RAMP_MS 8             // 軟啟動：每步間隔

CRGB ledsA[NUM_LEDS];
CRGB ledsB[NUM_LEDS];
int curA = 0, curB = 0;       // 目前實際輸出的 PWM（給軟啟動用）

void setup() {
  Serial.begin(115200);
  pinMode(FAN_A_PIN, OUTPUT);
  pinMode(FAN_B_PIN, OUTPUT);
  FastLED.addLeds<WS2812B, LED_A_PIN, GRB>(ledsA, NUM_LEDS);
  FastLED.addLeds<WS2812B, LED_B_PIN, GRB>(ledsB, NUM_LEDS);
  selfTest();
}

// 開機自檢：兩風機各軟啟動轉一下 + 兩燈帶跑一次能量條，確認接線。
void selfTest() {
  rampFan(FAN_A_PIN, curA, 180); delay(500); rampFan(FAN_A_PIN, curA, 0);
  rampFan(FAN_B_PIN, curB, 180); delay(500); rampFan(FAN_B_PIN, curB, 0);
  for (int e = 0; e <= 100; e += 10) { setLeds(ledsA, e, CRGB::Cyan); setLeds(ledsB, e, CRGB::Magenta); FastLED.show(); delay(50); }
  setLeds(ledsA, 0, CRGB::Cyan); setLeds(ledsB, 0, CRGB::Magenta); FastLED.show();
}

// 軟啟動：把某風機的 PWM 從 cur 緩慢帶到 target，避免兩顆 775 瞬間湧浪把電源拉垮。
void rampFan(int pin, int &cur, int target) {
  int step = (target > cur) ? RAMP_STEP : -RAMP_STEP;
  while (cur != target) {
    cur += step;
    if ((step > 0 && cur > target) || (step < 0 && cur < target)) cur = target;
    analogWrite(pin, cur);
    delay(RAMP_MS);
  }
}

// 遊戲每幀來的指令：dir='S' → 停；否則轉到指定 pwm（單向，不理 F/R 差異）。
void driveFan(int pin, int &cur, char dir, int pwm) {
  int target = (dir == 'S') ? 0 : pwm;
  // 遊玩中 pwm 由能量漸變，本身平滑 → 直接寫；只有大跳變才軟啟動
  if (target - cur > 60) rampFan(pin, cur, target);
  else { cur = target; analogWrite(pin, cur); }
}

void setLeds(CRGB* leds, int energy, CRGB color) {
  int n = (energy * NUM_LEDS) / 100;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = (i < n) ? color : CRGB::Black;
}

// 解析一個頻道 token，如 "A,F,180,45"
void applyToken(char* tok) {
  char id = tok[0];
  char* p = strtok(tok + 2, ",");   // dir
  char dir = p ? p[0] : 'S';
  int pwm = atoi(strtok(NULL, ",")); // pwm
  int energy = atoi(strtok(NULL, ",")); // energy
  if (id == 'A') { driveFan(FAN_A_PIN, curA, dir, pwm); setLeds(ledsA, energy, CRGB::Cyan); }
  else if (id == 'B') { driveFan(FAN_B_PIN, curB, dir, pwm); setLeds(ledsB, energy, CRGB::Magenta); }
}

void loop() {
  static char buf[64];
  static byte len = 0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      buf[len] = 0; len = 0;
      char* tok = strtok(buf, ";");
      while (tok) { applyToken(tok); tok = strtok(NULL, ";"); }
      FastLED.show();
    } else if (len < sizeof(buf) - 1) {
      buf[len++] = c;
    }
  }
}
