// 畫圈對決 — Arduino Nano 韌體（2 路 H 橋驅動板版：ENA/IN1/IN2，配 775 風機 + 12V 電源）
// 收 Web Serial 一行指令（分號分隔多個 token）：
//   A,F,180,45   遊戲頻道：頻道id,方向(F/R/S),PWM(0..255),能量(0..100)。A=1P、B=2P。
//   M,A,51       馬達分段測試：PWM 0..77。>38(15%) 的高檔限時 5 秒自動回落＋冷卻 8 秒。
//   E,D,9        燈條特效：目標 A/B/D(兩條)，特效碼 0..11（見 renderFx，與前端 protocol.js FX 對應）。
//   T,1          Nano 內建燈(D13)：測「網頁↔Nano」連線。
//
// ---- Arduino Nano 接腳（HQT 2 路直流馬達驅動板：ENA/INT1/INT2 每路） ----
//   馬達 A（風機 1P）：ENA→D3(PWM~)  INT1→D2  INT2→D4
//   馬達 B（風機 2P）：ENB→D11(PWM~)  INT3→D9  INT4→D10   ※ ENB 已從 D5 改到 D11（頻率對等）
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
#define ENB 11   // ⚠ 從 D5 移到 D11：D5(Timer0)PWM 頻率 976Hz、D3(Timer2)只有 490Hz，
                 //   頻率不同過光耦後有效動力差很大 → D11 與 D3 同 Timer2、同 490Hz，兩台才對等
#define IN3 9
#define IN4 10
// 兩台馬達個體差微調(%)：實測某台偏慢就把它調大（100=不加不減，例：TRIM_B 110 = B 加一成）
#define TRIM_A 100
#define TRIM_B 100
// WS2812 燈條
#define LED_A_PIN 7
#define LED_B_PIN 8
#define NUM_LEDS 240          // 4m×60燈/m=240（若你的條是30燈/m 改成120）
#define BRIGHT 50             // 亮度上限(0-255)：兩條全亮壓在 ~4A 內，保護 5V 5A 電源；覺得暗可加到 70
#define PWM_MAX 38            // 遊戲中風機上限 15%(255*0.15=38)：實測堵轉門檻~10%，留餘裕；硬上限保護驅動板
#define TEST_MAX 77           // 測試分頁上限 30%：高檔只能短時間跑（見 motorTest 限時）
#define KICK_PWM 64           // 啟動踢腳 25%：靜摩擦>動摩擦，起轉先踢一下再回運轉檔
#define KICK_MS 300           // 踢腳時長；兩台的踢腳會強制錯開，峰值電流永遠只有一台在抽

// 兩條共用一塊緩衝（輪流畫、各自輸出）→ RAM 減半，240 顆才塞得進 Nano 的 2KB SRAM
CRGB leds[NUM_LEDS];
CLEDController *ctlA, *ctlB;

// ---- 燈條特效引擎：每條一個模式，loop 依 millis 非阻塞演算 ----
// 特效碼：0全暗 1能量65 2能量100 3反轉倒流 4combo藍 5combo金 6combo彩虹
//         7PERFECT閃白(一次性) 8紅脈衝 9勝利煙火 10待機彩虹 11就位漸滿 12遊戲能量條(內部用)
#define FX_ENERGY 12
byte fxA = 0, fxB = 0;
byte energyA = 0, energyB = 0;
unsigned long fxStartA = 0, fxStartB = 0;
bool ledsDirty = false;  // 燈有變才輸出：show 會關中斷，狂 show 會掉序列資料

// ---- 馬達狀態（0=A/1P、1=B/2P）----
const byte M_INA[2] = {IN1, IN3}, M_INB[2] = {IN2, IN4}, M_EN[2] = {ENA, ENB};
struct MotorState { char dir; int targetPwm; unsigned long kickStartAt, kickEndAt; };
MotorState motors[2] = {{'S', 0, 0, 0}, {'S', 0, 0, 0}};
unsigned long mEnd[2] = {0, 0}, mCool[2] = {0, 0};  // 高檔測試限時/冷卻

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);      // D13 內建燈：測連線用
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  ctlA = &FastLED.addLeds<WS2812B, LED_A_PIN, GRB>(leds, NUM_LEDS);
  ctlB = &FastLED.addLeds<WS2812B, LED_B_PIN, GRB>(leds, NUM_LEDS);
  selfTest();
}

// 開機自檢（共 6 秒）：兩條燈條慢速閃爍 + 內建燈同步閃。馬達不動（要測馬達用測試分頁）。
void selfTest() {
  fxA = FX_ENERGY; fxB = FX_ENERGY;
  for (int i = 0; i < 5; i++) {                       // 5 輪 × (亮0.6s+暗0.6s) = 6 秒
    energyA = 100; energyB = 100; showStrips(); digitalWrite(LED_BUILTIN, HIGH); delay(600);
    energyA = 0;   energyB = 0;   showStrips(); digitalWrite(LED_BUILTIN, LOW);  delay(600);
  }
}

// H 橋直接輸出（最底層，套個體差微調後夾到 TEST_MAX 上限）
void motorOut(byte i, char dir, int pwm) {
  pwm = (int)((long)pwm * (i == 0 ? TRIM_A : TRIM_B) / 100);
  if (pwm > TEST_MAX) pwm = TEST_MAX;
  digitalWrite(M_INA[i], dir == 'F' ? HIGH : LOW);
  digitalWrite(M_INB[i], dir == 'R' ? HIGH : LOW);
  analogWrite(M_EN[i], dir == 'S' ? 0 : pwm);
}

// 遊戲馬達控制：從停止/換向起動時先「踢一腳」(KICK_PWM 300ms)再回目標檔（靜摩擦>動摩擦），
// 且兩台的踢腳強制錯開 → 峰值電流永遠只有一台在抽，解決低 PWM 起轉不了/雙機同啟電源垂降。
void setMotor(byte i, char dir, int pwm) {
  MotorState &m = motors[i];
  if (dir == 'S' || pwm <= 0) { m.dir = 'S'; m.kickStartAt = 0; m.kickEndAt = 0; motorOut(i, 'S', 0); return; }
  if (pwm > PWM_MAX) pwm = PWM_MAX;   // 遊戲硬上限 15%
  if (m.dir == dir) {
    m.targetPwm = pwm;
    if (!m.kickStartAt && !m.kickEndAt) motorOut(i, dir, pwm); // 踢腳/排程中不打斷
    return;
  }
  m.dir = dir; m.targetPwm = pwm;
  unsigned long now = millis(), start = now;
  MotorState &o = motors[1 - i];
  unsigned long oEnd = o.kickEndAt;
  if (o.kickStartAt && o.kickStartAt + KICK_MS > oEnd) oEnd = o.kickStartAt + KICK_MS;
  if (oEnd > start) start = oEnd;                              // 錯開：等另一台踢完再踢
  if (start > now) { m.kickStartAt = start; m.kickEndAt = 0; motorOut(i, 'S', 0); }
  else { m.kickStartAt = 0; m.kickEndAt = now + KICK_MS; motorOut(i, dir, KICK_PWM); }
}

// 踢腳排程推進（loop 每圈呼叫）
void motorTick(unsigned long now) {
  for (byte i = 0; i < 2; i++) {
    MotorState &m = motors[i];
    if (m.dir == 'S') continue;
    if (m.kickStartAt && now >= m.kickStartAt) { m.kickStartAt = 0; m.kickEndAt = now + KICK_MS; motorOut(i, m.dir, KICK_PWM); }
    else if (m.kickEndAt && now >= m.kickEndAt) { m.kickEndAt = 0; motorOut(i, m.dir, m.targetPwm); }
  }
}

// 馬達分段測試（不踢腳，量原始行為用）：>PWM_MAX 高檔限時 5 秒＋冷卻 8 秒；冷卻中只給 15%。
void motorTest(char ch, int pwm) {
  if (ch != 'A' && ch != 'B') return;  // 亂碼防呆
  byte i = ch == 'A' ? 0 : 1;
  motors[i].dir = 'S'; motors[i].kickStartAt = 0; motors[i].kickEndAt = 0; // 測試接管，清遊戲/踢腳狀態
  if (pwm > PWM_MAX) {
    if (millis() < mCool[i]) pwm = PWM_MAX;      // 冷卻中：退回安全檔
    else mEnd[i] = millis() + 5000;              // 高檔開 5 秒限時
  }
  if (pwm <= PWM_MAX) mEnd[i] = 0;               // 低檔/停不用限時
  motorOut(i, pwm > 0 ? 'F' : 'S', pwm);
}

// 能量條：前 n 顆上色、其餘黑
void barFill(int pct, CRGB color) {
  int n = (int)(((long)pct * NUM_LEDS) / 100);
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = (i < n) ? color : CRGB::Black;
}

// 這些特效會動，要連續刷新；其他是靜態畫一次就好
bool fxAnimated(byte fx) { return fx == 3 || fx == 6 || (fx >= 8 && fx <= 11); }

// 依特效碼畫一幀到共用緩衝。t=該特效已跑毫秒數。
void renderFx(byte fx, unsigned long t, CRGB base, int energy) {
  switch (fx) {
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
    case 7: fill_solid(leds, NUM_LEDS, t < 250 ? CRGB::White : CRGB::Black); break; // 一次性，loop 300ms 後自動歸零
    case 8: fill_solid(leds, NUM_LEDS, CRGB::Red); nscale8_video(leds, NUM_LEDS, beatsin8(72, 30, 255)); break;
    case 9: { // 勝利煙火：暗紫底 + 金白火花（位置用 t 雜湊，免每條各留狀態緩衝）
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

// 兩條輪流畫進共用緩衝、各自輸出（BRIGHT 同時當亮度/電流上限）
void showStrips() {
  unsigned long now = millis();
  renderFx(fxA, now - fxStartA, CRGB::Cyan, energyA);    ctlA->showLeds(BRIGHT);
  renderFx(fxB, now - fxStartB, CRGB::Magenta, energyB); ctlB->showLeds(BRIGHT);
}

// 解析一個 token（"A,F,180,45" / "M,A,51" / "E,D,9" / "T,1"）
// ⚠ 必須用 strtok_r：外層 loop() 也在切字串，plain strtok 全域狀態會互踩 → B 頻道整段被吃掉
void applyToken(char* tok) {
  char id = tok[0];
  if (id == 'T') { digitalWrite(LED_BUILTIN, atoi(tok + 2) ? HIGH : LOW); return; } // 內建燈測連線
  if (id == 'M') { motorTest(tok[2], atoi(tok + 4)); return; }                       // 馬達分段測試
  if (id == 'E') {                                                                    // 燈條特效
    char tgt = tok[2]; byte code = atoi(tok + 4);
    if (tgt == 'A' || tgt == 'D') { fxA = code; fxStartA = millis(); }
    if (tgt == 'B' || tgt == 'D') { fxB = code; fxStartB = millis(); }
    ledsDirty = true; return;
  }
  char* save;
  char* p = strtok_r(tok + 2, ",", &save);   // dir
  char dir = p ? p[0] : 'S';
  if (dir != 'F' && dir != 'R' && dir != 'S') return;  // 亂碼行(show 期間掉字)直接丟棄，下一幀會再送
  p = strtok_r(NULL, ",", &save); int pwm = p ? atoi(p) : 0;
  p = strtok_r(NULL, ",", &save); int energy = p ? atoi(p) : 0;
  if (energy < 0) energy = 0; if (energy > 100) energy = 100;
  if (id == 'A') { setMotor(0, dir, pwm); energyA = energy; fxA = FX_ENERGY; fxStartA = millis(); ledsDirty = true; }
  else if (id == 'B') { setMotor(1, dir, pwm); energyB = energy; fxB = FX_ENERGY; fxStartB = millis(); ledsDirty = true; }
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
  motorTick(nowMs);  // 踢腳排程推進
  // 馬達高檔測試到時：自動回落＋進冷卻
  for (byte i = 0; i < 2; i++) {
    if (mEnd[i] && nowMs > mEnd[i]) { motorOut(i, 'S', 0); mEnd[i] = 0; mCool[i] = nowMs + 8000; }
  }
  // PERFECT 閃白是一次性：300ms 後自動回全暗
  if (fxA == 7 && nowMs - fxStartA > 300) { fxA = 0; ledsDirty = true; }
  if (fxB == 7 && nowMs - fxStartB > 300) { fxB = 0; ledsDirty = true; }
  // 動態特效連續刷新(40ms)；靜態只在有變時輸出(100ms 節流)。show 關中斷會掉序列字，不能太密。
  bool anim = fxAnimated(fxA) || fxAnimated(fxB);
  if ((ledsDirty || anim) && nowMs - lastShow > (unsigned long)(anim ? 40 : 100)) {
    showStrips(); ledsDirty = false; lastShow = nowMs;
  }
}
