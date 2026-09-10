// 畫圈對決 — Arduino Nano 韌體【單燈條緊急展示版】
// 與正式版差異：只接一條 4m 燈條(D7)，所有燈光指令(A/B/D)都打到這一條；
//               單條獨享 5V 5A 電源，亮度上限拉高(BRIGHT 100)。馬達控制完全相同。
// 收 Web Serial 一行指令（分號分隔多個 token）：
//   A,F,180,45   遊戲頻道：頻道id,方向(F/R/S),PWM(0..255),能量(0..100)。A=1P、B=2P。
//   M,A,51       馬達分段測試：PWM 0..77。>31(12%) 的高檔限時 5 秒自動回落＋冷卻 8 秒。
//   E,D,9        燈條特效：目標 A/B/D 一律套用到這條，特效碼 0..11（與前端 protocol.js FX 對應）。
//   T,1          Nano 內建燈(D13)：測「網頁↔Nano」連線。
//
// ---- 接腳（同正式版，只是 D8 不接） ----
//   馬達 A（風機 1P）：ENA→D3(PWM~)  INT1→D2  INT2→D4
//   馬達 B（風機 2P）：ENB→D5(PWM~)  INT3→D9  INT4→D10
//   WS2812 燈條：DIN→D7（串 330Ω 更穩；資料要從燈條「箭頭起點」那端進）
//   GND：驅動板 GND + 5V燈電源 GND + Arduino GND 全部共地

#include <FastLED.h>

// 馬達 A（風機 1P）
#define ENA 3
#define IN1 2
#define IN2 4
// 馬達 B（風機 2P）
#define ENB 5
#define IN3 9
#define IN4 10
// WS2812 燈條（單條）
#define LED_PIN 7
#define NUM_LEDS 240          // 4m×60燈/m=240，全亮（若是30燈/m 改成120）
#define BRIGHT 100            // 單條獨享 5V 5A：全亮約 3.8A，比雙條版亮一倍；上限別超過 120
#define PWM_MAX 31            // 遊戲中風機上限 12%(255*0.12=31)：硬性保護，避免驅動板過熱
#define TEST_MAX 77           // 測試分頁上限 30%：高檔只能短時間跑（見 motorTest 限時）

CRGB leds[NUM_LEDS];

// ---- 燈條特效引擎（同正式版，單條）----
// 特效碼：0全暗 1能量65 2能量100 3反轉倒流 4combo藍 5combo金 6combo彩虹
//         7PERFECT閃白(一次性) 8紅脈衝 9勝利煙火 10待機彩虹 11就位漸滿 12遊戲能量條(內部用)
#define FX_ENERGY 12
byte fx = 0;
byte energy = 0;
unsigned long fxStart = 0;
bool ledsDirty = false;

// ---- 馬達高檔測試限時（>12% 跑 5 秒自動回落，冷卻 8 秒內只給 12%）----
unsigned long mEndA = 0, mCoolA = 0, mEndB = 0, mCoolB = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHT);
  selfTest();
}

// 開機自檢（共 6 秒）：燈條慢速閃爍 + 內建燈同步閃。馬達不動（要測馬達用測試分頁）。
void selfTest() {
  fx = FX_ENERGY;
  for (int i = 0; i < 5; i++) {                       // 5 輪 × (亮0.6s+暗0.6s) = 6 秒
    energy = 100; showStrip(); digitalWrite(LED_BUILTIN, HIGH); delay(600);
    energy = 0;   showStrip(); digitalWrite(LED_BUILTIN, LOW);  delay(600);
  }
}

// H 橋（遊戲用）：dir='F' 正轉、'R' 反轉、'S' 停。PWM 一律夾到 PWM_MAX(12%)保護驅動板。
void driveMotor(int inA, int inB, int en, char dir, int pwm) {
  digitalWrite(inA, dir == 'F' ? HIGH : LOW);
  digitalWrite(inB, dir == 'R' ? HIGH : LOW);
  int p = pwm > PWM_MAX ? PWM_MAX : pwm;
  analogWrite(en, dir == 'S' ? 0 : p);
}

// 測試分頁用：只正轉，上限 TEST_MAX(30%)。高檔限時控制在 motorTest / loop。
void driveMotorTest(int inA, int inB, int en, int pwm) {
  if (pwm > TEST_MAX) pwm = TEST_MAX;
  digitalWrite(inA, pwm > 0 ? HIGH : LOW);
  digitalWrite(inB, LOW);
  analogWrite(en, pwm);
}

// 馬達分段測試：>PWM_MAX 的檔位限時 5 秒（loop 到時自動回落＋進 8 秒冷卻）；冷卻中只給 12%。
void motorTest(char ch, int pwm) {
  if (ch != 'A' && ch != 'B') return;
  bool isA = ch == 'A';
  unsigned long *cool = isA ? &mCoolA : &mCoolB;
  unsigned long *end  = isA ? &mEndA  : &mEndB;
  if (pwm > PWM_MAX) {
    if (millis() < *cool) pwm = PWM_MAX;
    else *end = millis() + 5000;
  }
  if (pwm <= PWM_MAX) *end = 0;
  if (isA) driveMotorTest(IN1, IN2, ENA, pwm); else driveMotorTest(IN3, IN4, ENB, pwm);
}

// 能量條：前 n 顆上色、其餘黑
void barFill(int pct, CRGB color) {
  int n = (int)(((long)pct * NUM_LEDS) / 100);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = (i < n) ? color : CRGB::Black;
}

bool fxAnimated(byte m) { return m == 3 || m == 6 || (m >= 8 && m <= 11); }

// 依特效碼畫一幀。t=該特效已跑毫秒數。單條版基底色固定青色。
void renderFx(byte m, unsigned long t) {
  const CRGB base = CRGB::Cyan;
  switch (m) {
    default:
    case 0: fill_solid(leds, NUM_LEDS, CRGB::Black); break;
    case 1: barFill(65, base); break;
    case 2: barFill(100, base); break;
    case 3: { // 反轉倒流：條從尾端長 65%，一顆白色亮點往回跑
      fill_solid(leds, NUM_LEDS, CRGB::Black);
      int n = (int)((long)65 * NUM_LEDS / 100);
      for (int i = 0; i < n; i++) leds[NUM_LEDS - 1 - i] = base;
      leds[NUM_LEDS - 1 - (int)((t / 25) % NUM_LEDS)] = CRGB::White;
      break; }
    case 4: barFill(100, CRGB::Blue); break;
    case 5: barFill(100, CRGB(255, 150, 0)); break;
    case 6: fill_rainbow(leds, NUM_LEDS, (t / 15) & 0xFF, 255 / NUM_LEDS + 1); break;
    case 7: fill_solid(leds, NUM_LEDS, t < 250 ? CRGB::White : CRGB::Black); break;
    case 8: fill_solid(leds, NUM_LEDS, CRGB::Red); nscale8_video(leds, NUM_LEDS, beatsin8(72, 30, 255)); break;
    case 9: { // 勝利煙火：暗紫底 + 金白火花
      fill_solid(leds, NUM_LEDS, CRGB(10, 0, 18));
      for (byte k = 0; k < 10; k++) {
        unsigned int s = (unsigned int)(t / 90) * 31 + k * 7919; s ^= s << 7; s ^= s >> 9;
        leds[s % NUM_LEDS] = (k & 1) ? CRGB::Gold : CRGB::White;
      }
      break; }
    case 10: fill_rainbow(leds, NUM_LEDS, (t / 60) & 0xFF, 255 / NUM_LEDS + 1); nscale8_video(leds, NUM_LEDS, beatsin8(10, 25, 170)); break;
    case 11: barFill((int)((t % 3000) * 100 / 3000), CRGB::Green); break;
    case FX_ENERGY: barFill(energy, base); break;
  }
}

void showStrip() {
  renderFx(fx, millis() - fxStart);
  FastLED.show();
}

// 解析一個 token。單燈條版：A/B/D 的燈光通通套到這一條（按哪顆按鈕都有反應）。
// ⚠ 必須用 strtok_r：外層 loop() 也在切字串，plain strtok 全域狀態會互踩。
void applyToken(char* tok) {
  char id = tok[0];
  if (id == 'T') { digitalWrite(LED_BUILTIN, atoi(tok + 2) ? HIGH : LOW); return; }
  if (id == 'M') { motorTest(tok[2], atoi(tok + 4)); return; }
  if (id == 'E') { fx = atoi(tok + 4); fxStart = millis(); ledsDirty = true; return; }
  char* save;
  char* p = strtok_r(tok + 2, ",", &save);   // dir
  char dir = p ? p[0] : 'S';
  if (dir != 'F' && dir != 'R' && dir != 'S') return;  // 亂碼行直接丟棄
  p = strtok_r(NULL, ",", &save); int pwm = p ? atoi(p) : 0;
  p = strtok_r(NULL, ",", &save); int e = p ? atoi(p) : 0;
  if (e < 0) e = 0; if (e > 100) e = 100;
  if (id == 'A') { driveMotor(IN1, IN2, ENA, dir, pwm); energy = e; fx = FX_ENERGY; fxStart = millis(); ledsDirty = true; }
  else if (id == 'B') { driveMotor(IN3, IN4, ENB, dir, pwm); energy = e; fx = FX_ENERGY; fxStart = millis(); ledsDirty = true; }
}

void loop() {
  static char buf[64];
  static byte len = 0;
  static unsigned long lastShow = 0;
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      buf[len] = 0; len = 0;
      char* save;
      char* tok = strtok_r(buf, ";", &save);
      while (tok) { applyToken(tok); tok = strtok_r(NULL, ";", &save); }
    } else if (len < sizeof(buf) - 1) {
      buf[len++] = c;
    }
  }
  unsigned long nowMs = millis();
  if (mEndA && nowMs > mEndA) { driveMotorTest(IN1, IN2, ENA, 0); mEndA = 0; mCoolA = nowMs + 8000; }
  if (mEndB && nowMs > mEndB) { driveMotorTest(IN3, IN4, ENB, 0); mEndB = 0; mCoolB = nowMs + 8000; }
  if (fx == 7 && nowMs - fxStart > 300) { fx = 0; ledsDirty = true; }
  // 動態特效連續刷新(40ms)；靜態只在有變時輸出(100ms 節流)。show 關中斷會掉序列字，不能太密。
  if ((ledsDirty || fxAnimated(fx)) && nowMs - lastShow > (unsigned long)(fxAnimated(fx) ? 40 : 100)) {
    showStrip(); ledsDirty = false; lastShow = nowMs;
  }
}
