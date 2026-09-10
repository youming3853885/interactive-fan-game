// 畫圈對決 — Arduino Nano 韌體（2 路 H 橋驅動板版：ENA/IN1/IN2，配 775 風機 + 12V 電源）
// 收 Web Serial 一行指令：A,F,180,45;B,R,200,60\n
//   每個頻道 = 頻道id,方向(F/R/S),PWM(0..255),能量(0..100)
//   A = 1P（螢幕左）、B = 2P（螢幕右）。ENA/ENB 給 PWM 調速、IN 給方向。
//
// ---- Arduino Nano 接腳（HQT 2 路直流馬達驅動板：ENA/INT1/INT2 每路） ----
//   馬達 A（風機 1P）：ENA→D3(PWM~)  INT1→D2  INT2→D4
//   馬達 B（風機 2P）：ENB→D5(PWM~)  INT3→D9  INT4→D10
//   WS2812 燈條：DIN A→D7、DIN B→D8（串 330Ω 更穩）
//   GND：驅動板 GND + 5V燈電源 GND + Arduino GND 全部共地（沒共地→燈不亮/馬達不動）
//   USB：電腦（供電 + Web Serial）
//   驅動板 +5V：板上有光耦(EL357N)，若 IN 訊號沒反應，把 Nano 5V 接到板子 +5V 供光耦。
//   ※ 馬達 12V 走驅動板電源端（單路上限 7A）；Arduino 只出訊號+共地，不碰 12V。
//   ※ 若方向相反：對調該路 IN1/IN2 兩條線，或把韌體 'F'/'R' 的 HIGH/LOW 對調。

#include <FastLED.h>

// 馬達 A（風機 1P）
#define ENA 3
#define IN1 2
#define IN2 4
// 馬達 B（風機 2P）
#define ENB 5
#define IN3 9
#define IN4 10
// WS2812 燈條
#define LED_A_PIN 7
#define LED_B_PIN 8
#define NUM_LEDS 240          // 4m×60燈/m=240（若你的條是30燈/m 改成120）
#define BRIGHT 50             // 亮度上限(0-255)：兩條全亮壓在 ~4A 內，保護 5V 5A 電源；覺得暗可加到 70
#define PWM_MAX 31            // 風機輸出上限 12%(255*0.12=31)：硬性保護，避免驅動板過熱

// 兩條共用一塊緩衝（輪流畫、各自輸出）→ RAM 減半，240 顆才塞得進 Nano 的 2KB SRAM
CRGB leds[NUM_LEDS];
CLEDController *ctlA, *ctlB;
byte energyA = 0, energyB = 0;
bool ledsDirty = false;  // 燈有變才 show()：show() 會關中斷，狂 show 會掉序列資料

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);      // D13 內建燈：測連線用
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  ctlA = &FastLED.addLeds<WS2812B, LED_A_PIN, GRB>(leds, NUM_LEDS);
  ctlB = &FastLED.addLeds<WS2812B, LED_B_PIN, GRB>(leds, NUM_LEDS);
  selfTest();
}

// 開機自檢：內建燈眨 3 下 + 兩馬達各正轉一下（不逆轉）+ 兩燈帶跑一次能量條，確認接線。
void selfTest() {
  for (int i = 0; i < 3; i++) { digitalWrite(LED_BUILTIN, HIGH); delay(120); digitalWrite(LED_BUILTIN, LOW); delay(120); } // 內建燈眨 3 下
  driveMotor(IN1, IN2, ENA, 'F', PWM_MAX); delay(600);   // 自檢要短：自檢期間收不了指令，太長會讓「一連上就不能控制」
  driveMotor(IN1, IN2, ENA, 'S', 0);
  driveMotor(IN3, IN4, ENB, 'F', PWM_MAX); delay(600);
  driveMotor(IN3, IN4, ENB, 'S', 0);
  for (int e = 0; e <= 100; e += 10) { energyA = e; energyB = e; showStrips(); delay(50); }
  energyA = 0; energyB = 0; showStrips();
}

// H 橋：dir='F' 正轉、'R' 反轉、'S' 停；EN 給 PWM 調速。PWM 一律夾到 PWM_MAX(12%)保護驅動板。
void driveMotor(int inA, int inB, int en, char dir, int pwm) {
  digitalWrite(inA, dir == 'F' ? HIGH : LOW);
  digitalWrite(inB, dir == 'R' ? HIGH : LOW);
  int p = pwm > PWM_MAX ? PWM_MAX : pwm;   // 硬性上限，任何指令(自檢/測試/遊玩)都不超過 12%
  analogWrite(en, dir == 'S' ? 0 : p);
}

void fillEnergy(int energy, CRGB color) {
  int n = (energy * NUM_LEDS) / 100;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = (i < n) ? color : CRGB::Black;
}

// 兩條輪流畫進共用緩衝、各自輸出（BRIGHT 同時當亮度/電流上限）
void showStrips() {
  fillEnergy(energyA, CRGB::Cyan);    ctlA->showLeds(BRIGHT);
  fillEnergy(energyB, CRGB::Magenta); ctlB->showLeds(BRIGHT);
}

// 解析一個頻道 token，如 "A,F,180,45"
// ⚠ 必須用 strtok_r：外層 loop() 也在切字串，plain strtok 全域狀態會互踩 → B 頻道整段被吃掉
void applyToken(char* tok) {
  char id = tok[0];
  if (id == 'T') { digitalWrite(LED_BUILTIN, atoi(tok + 2) ? HIGH : LOW); return; } // 內建燈測連線
  char* save;
  char* p = strtok_r(tok + 2, ",", &save);   // dir
  char dir = p ? p[0] : 'S';
  if (dir != 'F' && dir != 'R' && dir != 'S') return;  // 亂碼行(show 期間掉字)直接丟棄，下一幀會再送
  p = strtok_r(NULL, ",", &save); int pwm = p ? atoi(p) : 0;
  p = strtok_r(NULL, ",", &save); int energy = p ? atoi(p) : 0;
  if (energy < 0) energy = 0; if (energy > 100) energy = 100;
  if (id == 'A') { driveMotor(IN1, IN2, ENA, dir, pwm); energyA = energy; ledsDirty = true; }
  else if (id == 'B') { driveMotor(IN3, IN4, ENB, dir, pwm); energyB = energy; ledsDirty = true; }
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
  // 燈有變且距上次 >100ms 才更新：兩條 240 顆各輸出一次會關中斷 ~14ms，太頻繁會讓序列指令掉字
  if (ledsDirty && millis() - lastShow > 100) { showStrips(); ledsDirty = false; lastShow = millis(); }
}
