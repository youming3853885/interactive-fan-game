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
#define NUM_LEDS 100          // 依實際燈帶顆數調整（4m 條先取前 100 顆）

CRGB ledsA[NUM_LEDS];
CRGB ledsB[NUM_LEDS];

void setup() {
  Serial.begin(115200);
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  FastLED.addLeds<WS2812B, LED_A_PIN, GRB>(ledsA, NUM_LEDS);
  FastLED.addLeds<WS2812B, LED_B_PIN, GRB>(ledsB, NUM_LEDS);
  selfTest();
}

// 開機自檢：兩馬達各正反轉一下 + 兩燈帶跑一次能量條，確認接線。
void selfTest() {
  driveMotor(IN1, IN2, ENA, 'F', 120); delay(400);
  driveMotor(IN1, IN2, ENA, 'R', 120); delay(400);
  driveMotor(IN1, IN2, ENA, 'S', 0);
  driveMotor(IN3, IN4, ENB, 'F', 120); delay(400);
  driveMotor(IN3, IN4, ENB, 'R', 120); delay(400);
  driveMotor(IN3, IN4, ENB, 'S', 0);
  for (int e = 0; e <= 100; e += 10) { setLeds(ledsA, e, CRGB::Cyan); setLeds(ledsB, e, CRGB::Magenta); FastLED.show(); delay(50); }
  setLeds(ledsA, 0, CRGB::Cyan); setLeds(ledsB, 0, CRGB::Magenta); FastLED.show();
}

// H 橋：dir='F' 正轉、'R' 反轉、'S' 停；EN 給 PWM 調速。
void driveMotor(int inA, int inB, int en, char dir, int pwm) {
  digitalWrite(inA, dir == 'F' ? HIGH : LOW);
  digitalWrite(inB, dir == 'R' ? HIGH : LOW);
  analogWrite(en, dir == 'S' ? 0 : pwm);
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
  if (id == 'A') { driveMotor(IN1, IN2, ENA, dir, pwm); setLeds(ledsA, energy, CRGB::Cyan); }
  else if (id == 'B') { driveMotor(IN3, IN4, ENB, dir, pwm); setLeds(ledsB, energy, CRGB::Magenta); }
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
