#include <FastLED.h>

// ---- 接腳（對應設計文件） ----
#define ENA 3
#define IN1 2
#define IN2 4
#define ENB 5
#define IN3 7
#define IN4 8
#define LED_A_PIN 6
#define LED_B_PIN 9
#define NUM_LEDS 30            // 依實際燈帶顆數調整

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
  driveMotor(IN1, IN2, ENA, 'F', 150); delay(400);
  driveMotor(IN1, IN2, ENA, 'R', 150); delay(400);
  driveMotor(IN1, IN2, ENA, 'S', 0);
  driveMotor(IN3, IN4, ENB, 'F', 150); delay(400);
  driveMotor(IN3, IN4, ENB, 'R', 150); delay(400);
  driveMotor(IN3, IN4, ENB, 'S', 0);
  for (int e = 0; e <= 100; e += 10) { setLeds(ledsA, e, CRGB::Cyan); setLeds(ledsB, e, CRGB::Magenta); FastLED.show(); delay(50); }
  setLeds(ledsA, 0, CRGB::Cyan); setLeds(ledsB, 0, CRGB::Magenta); FastLED.show();
}

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
