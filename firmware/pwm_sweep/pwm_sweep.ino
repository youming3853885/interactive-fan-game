// PWM 門檻徹查（一次性測試韌體）
// 兩顆馬達從 PWM 20 起、每段 +5；每段「先確實停 1 秒 → 再通電 1.5 秒」，
// 這樣測的是「從靜止啟動」的門檻（最嚴苛）。Serial Monitor(115200) 會印出當前 PWM。
//
// 用法：
//   1. 上傳這支 → 開 Serial Monitor(115200)。
//   2. 盯著扇葉：看它「從完全靜止開始轉起來」是在哪個 PWM 值（螢幕會同步印）。
//      → 那個值就是「啟動門檻」。
//   3. 想更準：三用電表串在馬達正極(10A檔)，看電流由高(堵轉)掉下來(轉起來)的那一刻。
//   4. 測完把「啟動門檻 PWM」回報，我幫你設 PWM_MAX / kick-start。
//
// 接腳同正式韌體：馬達A ENA=D3/IN1=D2/IN2=D4；馬達B ENB=D5/IN3=D9/IN4=D10。

#define ENA 3
#define IN1 2
#define IN2 4
#define ENB 5
#define IN3 9
#define IN4 10

void fwd(int inA, int inB, int en, int pwm) { digitalWrite(inA, HIGH); digitalWrite(inB, LOW); analogWrite(en, pwm); }
void off(int inA, int inB, int en) { digitalWrite(inA, LOW); digitalWrite(inB, LOW); analogWrite(en, 0); }

void setup() {
  Serial.begin(115200);
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT); pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  Serial.println("PWM 門檻掃描：看扇葉『從靜止開始轉』在哪個 PWM(每段先停1秒再轉1.5秒)");
}

void loop() {
  for (int pwm = 20; pwm <= 140; pwm += 5) {
    off(IN1, IN2, ENA); off(IN3, IN4, ENB); delay(1000);   // 先確實停止(測從靜止啟動)
    Serial.print("PWM="); Serial.print(pwm);
    Serial.print("  (約 "); Serial.print(pwm * 100 / 255); Serial.println("%)");
    fwd(IN1, IN2, ENA, pwm); fwd(IN3, IN4, ENB, pwm); delay(1500);
  }
  off(IN1, IN2, ENA); off(IN3, IN4, ENB);
  Serial.println("--- 掃完一輪，5 秒後重來 ---");
  delay(5000);
}
