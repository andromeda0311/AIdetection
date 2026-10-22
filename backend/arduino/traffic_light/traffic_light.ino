// Traffic Light Firmware Redesign
// FW_V5 (Sanity Checked & Cleaned)

// Pin definitions (Arduino → 7‑segment display mapping)
constexpr int TL_GREEN   = 9;   // Traffic‑light green LED
constexpr int TL_YELLOW  = 10;  // Traffic‑light yellow LED
constexpr int TL_RED     = 11;  // Traffic‑light red LED

// 7‑segment segment pins (each through a 220 Ω resistor)
constexpr int SEG_A  = 2;   // D2  → segment A (display pin 10)
constexpr int SEG_B  = 3;   // D3  → segment B (display pin 9)
constexpr int SEG_C  = 4;   // D4  → segment C (display pin 1)
constexpr int SEG_D  = 5;   // D5  → segment D (display pin 4)
constexpr int SEG_E  = 12;  // D12 → segment E (display pin 3)
constexpr int SEG_F  = 13;  // D13 → segment F (display pin 6)
constexpr int SEG_G  = A0;  // A0  → segment G (display pin 5)
constexpr int SEG_DP = A1;  // A1  → decimal point (display pin 2)

// Digit‑common pins (direct, no resistor)
constexpr int DIGIT_TENS = A2; // A2 → tens digit common (display pin 8)
constexpr int DIGIT_ONES = A3; // A3 → ones digit common (display pin 7)

// Common‑cathode display configuration
constexpr bool COMMON_CATHODE = true;
constexpr int DIGIT_ON  = COMMON_CATHODE ? LOW  : HIGH; 
constexpr int DIGIT_OFF = COMMON_CATHODE ? HIGH : LOW;
constexpr int SEG_ON    = COMMON_CATHODE ? HIGH : LOW;
constexpr int SEG_OFF   = COMMON_CATHODE ? LOW  : HIGH;

// Runtime state
int countdownCars = 0;                  // cars countdown (0‑99)
unsigned long lastDisplayUpdate = 0;    // for multiplex timing
const unsigned long DISPLAY_REFRESH_MS = 5;
String inputBuffer = "";

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

void setTrafficState(int greenLevel, int yellowLevel, int redLevel) {
  digitalWrite(TL_GREEN,  greenLevel);
  digitalWrite(TL_YELLOW, yellowLevel);
  digitalWrite(TL_RED,    redLevel);
}

void setNormalTraffic()  { setTrafficState(HIGH, LOW, LOW); }
void setCautionTraffic() { setTrafficState(LOW, HIGH, LOW); }
void setStopTraffic()    { setTrafficState(LOW, LOW, HIGH); }

void clearSegments() {
  digitalWrite(SEG_A,  SEG_OFF);
  digitalWrite(SEG_B,  SEG_OFF);
  digitalWrite(SEG_C,  SEG_OFF);
  digitalWrite(SEG_D,  SEG_OFF);
  digitalWrite(SEG_E,  SEG_OFF);
  digitalWrite(SEG_F,  SEG_OFF);
  digitalWrite(SEG_G,  SEG_OFF);
  digitalWrite(SEG_DP, SEG_OFF);
}

void clearDisplay() {
  digitalWrite(DIGIT_TENS, DIGIT_OFF);
  digitalWrite(DIGIT_ONES, DIGIT_OFF);
  clearSegments();
}

// 0‑9 segment patterns (a‑g + dp)
constexpr byte DIGIT_PATTERNS[10] = {
  0b01111110, // 0
  0b00110000, // 1
  0b01101101, // 2
  0b01111001, // 3
  0b00110011, // 4
  0b01011011, // 5
  0b01011111, // 6
  0b01110000, // 7
  0b01111111, // 8
  0b01111011  // 9
};

void showDigit(int d) {
  if (d < 0 || d > 9) d = 0;
  byte pat = DIGIT_PATTERNS[d];
  digitalWrite(SEG_A,  (pat & 0b01000000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_B,  (pat & 0b00100000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_C,  (pat & 0b00010000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_D,  (pat & 0b00001000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_E,  (pat & 0b00000100) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_F,  (pat & 0b00000010) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_G,  (pat & 0b00000001) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_DP, SEG_OFF);
}

// Multiplexed non-blocking display update for loop()
void updateDisplay() {
  if (countdownCars <= 0) { 
    clearDisplay(); 
    return; 
  }
  
  unsigned long now = millis();
  if (now - lastDisplayUpdate < DISPLAY_REFRESH_MS) return;
  lastDisplayUpdate = now;

  static uint8_t digitIdx = 0;
  
  // Turn off both digits first to prevent ghosting/bleeding
  digitalWrite(DIGIT_TENS, DIGIT_OFF);
  digitalWrite(DIGIT_ONES, DIGIT_OFF);
  clearSegments();

  int value;
  int digitPin;
  if (digitIdx == 0) {
    value = (countdownCars / 10) % 10;
    digitPin = DIGIT_TENS;
  } else {
    value = countdownCars % 10;
    digitPin = DIGIT_ONES;
  }
  
  showDigit(value);
  digitalWrite(digitPin, DIGIT_ON);
  
  digitIdx = (digitIdx + 1) & 0x01;
}

// -----------------------------------------------------------------------------
// Serial command handling
// -----------------------------------------------------------------------------

void handleCommand(const String &cmdRaw) {
  String cmd = cmdRaw;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "PING") {
    Serial.println(F("PONG"));
    return;
  }
  if (cmd == "MODE CC") {
    Serial.println(F("MODE=CC"));
    return;
  }
  if (cmd == "MODE CA") {
    Serial.println(F("MODE=CA"));
    return;
  }
  if (cmd == "TEST") {
    clearDisplay();
    countdownCars = 23;
    unsigned long start = millis();
    while (millis() - start < 3000) updateDisplay();
    countdownCars = 0;
    clearDisplay();
    return;
  }
  if (cmd == "SANITY") {
    // Run counting sequence 0 to 35 as a quick hardware test
    for (int i = 0; i <= 35; i++) {
      countdownCars = i;
      unsigned long start = millis();
      while (millis() - start < 50) updateDisplay();
    }
    countdownCars = 0;
    clearDisplay();
    return;
  }
  if (cmd == "STOP_TRAFFIC") {
    setStopTraffic();
    Serial.println(F("TRAFFIC_STOPPED"));
    return;
  }
  if (cmd == "NORMAL_TRAFFIC") {
    setNormalTraffic();
    countdownCars = 0;
    clearDisplay();
    Serial.println(F("TRAFFIC_NORMAL"));
    return;
  }
  if (cmd == "CAUTION_TRAFFIC") {
    setCautionTraffic();
    Serial.println(F("TRAFFIC_CAUTION"));
    return;
  }
  if (cmd.startsWith("COUNTDOWN:CARS:")) {
    int val = cmd.substring(15).toInt();
    countdownCars = constrain(val, 0, 99);
    return;
  }
  // Legacy shortcuts
  if (cmd == "GREEN") { setNormalTraffic(); return; }
  if (cmd == "YELLOW") { setCautionTraffic(); return; }
  if (cmd == "RED") { setStopTraffic(); return; }
}

// -----------------------------------------------------------------------------
// Boot‑time self‑test
// -----------------------------------------------------------------------------

void runBootTest() {
  setNormalTraffic();
  delay(500);
  countdownCars = 23;
  unsigned long start = millis();
  while (millis() - start < 2000) updateDisplay();
  countdownCars = 0;
  clearDisplay();
}

// -----------------------------------------------------------------------------
// Arduino lifecycle
// -----------------------------------------------------------------------------

void setup() {
  // Traffic LEDs
  pinMode(TL_GREEN,   OUTPUT);
  pinMode(TL_YELLOW,  OUTPUT);
  pinMode(TL_RED,     OUTPUT);
  
  // 7‑segment segment pins
  pinMode(SEG_A,  OUTPUT);
  pinMode(SEG_B,  OUTPUT);
  pinMode(SEG_C,  OUTPUT);
  pinMode(SEG_D,  OUTPUT);
  pinMode(SEG_E,  OUTPUT);
  pinMode(SEG_F,  OUTPUT);
  pinMode(SEG_G,  OUTPUT);
  pinMode(SEG_DP, OUTPUT);
  
  // Digit commons
  pinMode(DIGIT_TENS, OUTPUT);
  pinMode(DIGIT_ONES, OUTPUT);

  setNormalTraffic();
  clearDisplay();

  Serial.begin(9600);
  Serial.println(F("FW_V5"));
  Serial.println(F("ARDUINO_READY"));

  runBootTest();
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(inputBuffer);
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
    }
  }
  updateDisplay();
}