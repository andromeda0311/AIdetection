# Arduino Uno — Traffic Light Wiring & Web Integration Guide

This guide shows how to wire **one 3-LED traffic light** and **one 2-digit 7-segment display** (vehicle countdown) to an **Arduino Uno** and connect it to the thesis web system (YOLO live detection → Node.js backend → dashboard → Arduino over USB serial).

> This is the **simple build**: one traffic light + one countdown display. Hardware is verified piece-by-piece before scaling up to two lights and two displays.

---

## How it fits the web system

```
Webcam → Python YOLO (:8000)
              ↓ detection JSON
         Node backend (:4000)
              ↓ WebSocket state → Vue dashboard (:5173)
              ↓ USB serial commands
         Arduino Uno → Traffic Light (Green/Yellow/Red)
                    → 2-Digit 7-Segment Display (cars countdown)
```

When a pedestrian stays in frame for **5 seconds**, the backend sends:

```text
CAUTION_TRAFFIC   (yellow for 3 seconds)
STOP_TRAFFIC      (red for 15 seconds)
NORMAL_TRAFFIC    (back to green)
```

The Arduino only receives **high-level commands**. It does not run YOLO and does not connect to Wi‑Fi. All timing (5s / 15s) is handled by the Node.js backend.

---

## Parts you need

| Item | Qty | Notes |
|------|-----|-------|
| Arduino Uno | 1 | Or compatible board |
| USB A → B cable | 1 | Powers the board and serial link to PC |
| Red LED | 1 | Traffic stop |
| Yellow LED | 1 | Caution |
| Green LED | 1 | Normal / go |
| 2-digit 7-segment display (10-pin, common cathode) | 1 | Vehicle countdown |
| 220 Ω resistors | 11 | 3 for LEDs + 8 for display segment lines |
| Breadboard + jumper wires | 1 set | For prototyping |

---

## Pin wiring (fixed in firmware)

Use these **digital pins** — they match `backend/arduino/traffic_light/traffic_light.ino`:

### Traffic Light

| LED color | Arduino pin | Resistor | Connect to |
|-----------|-------------|----------|------------|
| **Green** | **D9** | 220 Ω | LED → GND |
| **Yellow** | **D10** | 220 Ω | LED → GND |
| **Red** | **D11** | 220 Ω | LED → GND |

> **LED polarity:** the **anode (long leg)** connects to the Arduino pin through the 220 Ω resistor. The **cathode (short leg, flat side)** connects to GND. If an LED does not light, flip it around — LEDs only work in one direction.

**LED wiring details**

| LED color | Arduino pin | Resistor | Long leg (anode) → Arduino pin | Short leg (cathode) → GND |
|-----------|------------|----------|------------------------------|---------------------------|
| Green     | **D9**     | 220 Ω   | Through resistor to D9        | Direct to GND |
| Yellow    | **D10**    | 220 Ω   | Through resistor to D10       | Direct to GND |
| Red       | **D11**    | 220 Ω   | Through resistor to D11       | Direct to GND |


### 2‑Digit 7‑Segment Display (10‑pin, common‑cathode)

All **8 segment lines** (a‑g + decimal point) are driven through **220 Ω resistors**. The two **digit‑common pins** connect **directly** to Arduino pins (active LOW for common‑cathode).

#### Your display's physical pin mapping (10‑pin package)

When looking at the display from the front (segments facing you), pins are numbered 1–10 left to right along the bottom edge:

| Display Pin | Function | Segment Name |
|-------------|----------|--------------|
81: | **Pin 1** | Segment C | C |
82: | **Pin 2** | Decimal Point (DP) | DP |
83: | **Pin 3** | Segment E | E |
84: | **Pin 4** | Segment D | D |
85: | **Pin 5** | Segment G | G |
86: | **Pin 6** | Segment F | F |
87: | **Pin 7** | Digit 2 Common Cathode (Ones / Right Digit) | — |
88: | **Pin 8** | Digit 1 Common Cathode (Tens / Left Digit) | — |
89: | **Pin 9** | Segment B | B |
90: | **Pin 10** | Segment A | A |
| **Pin 2** | Segment D | D |
| **Pin 3** | Decimal Point | DP |
| **Pin 4** | Segment C | C |
| **Pin 5** | Segment G | G |
| **Pin 6** | ONES (digit 2 common) | — |
| **Pin 7** | Segment B | B |
| **Pin 8** | TENS (digit 1 common) | — |
| **Pin 9** | Segment F | F |
| **Pin 10** | Segment A | A |

> **Tip:** Pin 7 and Pin 8 are the **digit common** pins (cathodes). They are **not** Arduino GND. Pin 8 must go to **A2** and pin 7 to **A3** — two separate wires. If both go to GND, or both go to the same Arduino pin, **03 and 23 will both show as 33**.

#### Physical pin to Arduino wiring

| Display Pin | Segment/Function | Arduino Pin | Resistor |
|-------------|------------------|-------------|----------|
96: | Pin 10 | Segment A | **D2** | 220 Ω |
97: | Pin 9  | Segment B | **D3** | 220 Ω |
98: | Pin 1  | Segment C | **D4** | 220 Ω |
99: | Pin 4  | Segment D | **D5** | 220 Ω |
100: | Pin 3  | Decimal Point (DP) | **A1** (D15) | 220 Ω |
101: | Pin 5  | Segment G | **A0** (D14) | 220 Ω |
102: | Pin 6 | Digit 2 (ONES) GND | **A3** | — (direct) |
103: | Pin 7 | Segment F | **D13** | 220 Ω |
104: | Pin 8 | Digit 1 (TENS) GND | **A2** (D16) | — (direct) |
| Pin 9  | Segment F | **D13** | 220 Ω |
| Pin 1  | Segment E | **D12** | 220 Ω |
| Pin 2  | Segment D | **D5** | 220 Ω |
| Pin 3  | Decimal Point (DP) | **A1** (D15) | 220 Ω |
| Pin 4  | Segment C | **D4** | 220 Ω |
| Pin 5  | Segment G | **A0** (D14) | 220 Ω |
| Pin 6 | Digit 2 (ONES) GND | **A3** | — (direct) |
| Pin 7 | Segment B | **D3** | 220 Ω |
| Pin 8 | Digit 1 (TENS) GND | **A2** (D16) | — (direct) |

> **Important:** Segment pins (1,2,3,4,5,6,9,10) go through **220 Ω resistors**. Digit ground pins (7,8) connect **directly** — no resistors.

#### Digit‑select pins (2 pins, no resistors, active LOW)

| Arduino pin | Display | Digit (position) |
|-------------|---------|------------------|
| **A2** (D16) | Display | Tens (Digit 1) — Display Pin 8 |
| **A3** (D17) | Display | Ones (Digit 2) — Display Pin 7 |

> **Note:** A2/A3 are analog pins that work as digital D16/D17. The firmware drives digit pins **LOW** to activate (common‑cathode). If you ever use a common‑anode display, invert the logic.

### Wiring Diagram

![Arduino Wiring Schematic](file:///C:/Users/Jed%20Nikko/.gemini/antigravity-ide/brain/675df783-19e5-4871-9a3f-4d61c414b31d/arduino_wiring_schematic_1789705579227.png)

> **Overview:** This diagram shows the full wiring of the traffic‑light LEDs and the 2‑digit 7‑segment display to the Arduino Uno, matching the pin‑mapping table.



1. **Identify pinout** – Use the table above. Your display Pin 1 = Segment C, Pin 10 = Segment A, etc.
2. **Wire segments** – connect each segment pin through a **220 Ω resistor** to the Arduino segment pin: Pin 10 → D2, Pin 9 → D3, Pin 1 → D4, Pin 4 → D5, Pin 3 → D12, Pin 6 → D13, Pin 5 → A0, Pin 2 → A1.
3. **Connect digit commons** – Pin 8 (Digit 1, tens) → **A2**, Pin 7 (Digit 2, ones) → **A3**. **No resistors** on these lines.
4. **Ground** – LED cathodes (traffic light) → GND.
5. **Wiring diagram** – see below:

![Arduino Wiring Schematic](file:///C:/Users/Jed%20Nikko/.gemini/antigravity-ide/brain/675df783-19e5-4871-9a3f-4d61c414b31d/arduino_wiring_schematic_1789705579227.png)

> **Note:** The above diagram visualizes the exact wiring described in the pin‑mapping table.
│  GND ──► LED cathodes only (display commons are pulled LOW by A2/A3)       │
└────────────────────────────────────────────────────────────────────────────┘
     │
     └── USB to PC (serial + power)
```

##### 2-Digit 7-Segment Display — full pinout (10-pin, COMMON CATHODE)

```text
                            ┌──── segment letter positions ────┐
                            │            ── A ──               │
 TOP edge (pins 6→10):      │           │       │              │
   ○ pin 6  = Seg F  → D13  │           F       B   [220Ω ea.] │
      [220Ω]                │           │── G ──│              │
   ○ pin 7  = DIGIT 2 common│           E       C              │
      cathode (ONES) → A3   │           │       │              │
      [DIRECT, no resistor] │            ── D ──   •DP         │
   ○ pin 8  = DIGIT 1 common└──────────────────────────────────┘
      cathode (TENS) → A2       Legend: A=D2 · B=D3 · C=D4 · D=D5
      [DIRECT, no resistor]             E=D12 · F=D13 · G=A0 · DP=A1
   ○ pin 9  = Seg B  → D3   [220Ω]
   ○ pin 10 = Seg A  → D2   [220Ω]
  ┌───────────────────────────────────────────┐
  │       ┌───┐             ┌───┐             │
  │       │ 8 │ •DP         │ 8 │ •DP         │
  │       └───┘             └───┘             │
  │      DIGIT 1           DIGIT 2            │
  │      (tens)            (ones)             │
  │     pin 8→A2          pin 7→A3            │
  └───────────────────────────────────────────┘
 BOTTOM edge (pins 1→5):
   ○ pin 1  = Seg C  → D4   [220Ω]
   ○ pin 2  = DP     → A1   [220Ω]
   ○ pin 3  = Seg E  → D12  [220Ω]
   ○ pin 4  = Seg D  → D5   [220Ω]
   ○ pin 5  = Seg G  → A0   [220Ω]

 KEY:  ○ = display pin     → = Arduino pin
 [220Ω]  = 220 Ω resistor REQUIRED (all 8 segment lines: pins 1-6, 9, 10)
 [DIRECT] = plain wire, NO resistor (digit common cathodes: pins 7, 8)
 Type = COMMON CATHODE: segment ON = pin HIGH, digit selected = pin LOW
```

> **Do not** connect display segment pins directly to Arduino pins without the 220 Ω resistors. Digit‑common pins connect directly (they are switched to ground by the MCU).

---

## Firmware — code to upload

**Yes, you must upload this code once.** Plugging in USB only provides power and the serial link — the Arduino will not control the LEDs or talk to the web app until this sketch is flashed.

The file lives in the repo at:

```text
backend/arduino/traffic_light/traffic_light.ino
```

### Upload steps (Arduino IDE)

1. Install [Arduino IDE](https://www.arduino.cc/en/software).
2. Connect the Uno via USB.
3. **File → New Sketch** (or open `backend/arduino/traffic_light/traffic_light.ino`).
4. Paste the full sketch below if starting from a blank sketch.
5. **Tools → Board → Arduino Uno**
6. **Tools → Port →** select your COM port (e.g. `COM4` on Windows).
7. Click **Upload** (→ arrow button).
8. Wait for **Done uploading**.

On success, open **Tools → Serial Monitor**, set baud to **9600** and line ending to **Newline**.

When the Arduino boots or resets, it executes an automatic **1.5-second Hardware Self-Test**:
1. Cycles Traffic Light LEDs (Red $\rightarrow$ Yellow $\rightarrow$ Green).
2. Lights up the 2-digit 7-segment display with `"88"`.
3. Prints `ARDUINO_READY` to the serial monitor.

> **Tip:** Send `TEST\n` in the Serial Monitor — the display should show **23** (not 33). Send `COUNTDOWN:CARS:03` and confirm it shows **03**.
> **Important:** Close the Serial Monitor before starting the Node.js backend — Windows allows only one program to use the COM port at a time.
> **Source of truth:** upload `backend/arduino/traffic_light/traffic_light.ino`. The Node.js backend cannot flash this sketch by itself.

### Full sketch (`traffic_light.ino`)

```cpp
// Traffic light firmware for the live YOLO pedestrian crosswalk system.
// Simple build: 1 traffic light (3 LEDs) + 1× 2-digit 7-segment countdown display (cars).
//
// The Node.js backend sends high-level ASCII commands over USB serial:
//   STOP_TRAFFIC\n  NORMAL_TRAFFIC\n  CAUTION_TRAFFIC\n  COUNTDOWN:CARS:<sec>\n  PING\n
// (COUNTDOWN:PEDS is accepted but ignored - this build has only one display.)
//
// Responses:
//   ARDUINO_READY  TRAFFIC_STOPPED  TRAFFIC_NORMAL  TRAFFIC_CAUTION  PONG
//
// Wiring:
//   Traffic Light 1: Green=D9, Yellow=D10, Red=D11 (each 220 ohm to GND)
//   7-Segment (cars): Segments a-g,dp = D2,D3,D4,D5,D12,D13,A0,A1 (each 220 ohm)
//   Digit selects (cars): Tens=A2, Ones=A3 (direct, common cathode)
//
// Serial speed must match YOLO_LIVE_ARDUINO_BAUD in the backend .env (default 9600).

const int TL_GREEN = 9;
const int TL_YELLOW = 10;
const int TL_RED = 11;

const int SEG_A = 2;
const int SEG_B = 3;
const int SEG_C = 4;
const int SEG_D = 5;
const int SEG_E = 12;
const int SEG_F = 13;
const int SEG_G = A0;  // D14
const int SEG_DP = A1; // D15

const int DIGIT_TENS = A2; // D16
const int DIGIT_ONES = A3; // D17

// true  = common cathode (this build): digit ON = LOW, segment ON = HIGH
// false = common anode: digit ON = HIGH, segment ON = LOW
const bool COMMON_CATHODE = true;
const int DIGIT_ON = COMMON_CATHODE ? LOW : HIGH;
const int DIGIT_OFF = COMMON_CATHODE ? HIGH : LOW;
const int SEG_ON = COMMON_CATHODE ? HIGH : LOW;
const int SEG_OFF = COMMON_CATHODE ? LOW : HIGH;

int countdownCars = 0;
unsigned long lastDisplayUpdate = 0;
const unsigned long DISPLAY_REFRESH_MS = 5;

String inputBuffer = "";

const byte DIGIT_PATTERNS[10] = {
  0b01111110, // 0 (A,B,C,D,E,F on, G off)
  0b00110000, // 1 (B,C on)
  0b01101101, // 2 (A,B,D,E,G on)
  0b01111001, // 3 (A,B,C,D,G on)
  0b00110011, // 4 (B,C,F,G on)
  0b01011011, // 5 (A,C,D,F,G on)
  0b01011111, // 6 (A,C,D,E,F,G on)
  0b01110000, // 7 (A,B,C on)
  0b01111111, // 8 (A,B,C,D,E,F,G on)
  0b01111011  // 9 (A,B,C,D,F,G on)
};

void setNormalTraffic() {
  digitalWrite(TL_GREEN, HIGH);
  digitalWrite(TL_YELLOW, LOW);
  digitalWrite(TL_RED, LOW);
}

void setCautionTraffic() {
  digitalWrite(TL_GREEN, LOW);
  digitalWrite(TL_YELLOW, HIGH);
  digitalWrite(TL_RED, LOW);
}

void setStopTraffic() {
  digitalWrite(TL_GREEN, LOW);
  digitalWrite(TL_YELLOW, LOW);
  digitalWrite(TL_RED, HIGH);
}

void clearDisplay() {
  digitalWrite(SEG_A, SEG_OFF);
  digitalWrite(SEG_B, SEG_OFF);
  digitalWrite(SEG_C, SEG_OFF);
  digitalWrite(SEG_D, SEG_OFF);
  digitalWrite(SEG_E, SEG_OFF);
  digitalWrite(SEG_F, SEG_OFF);
  digitalWrite(SEG_G, SEG_OFF);
  digitalWrite(SEG_DP, SEG_OFF);
  digitalWrite(DIGIT_TENS, DIGIT_OFF);
  digitalWrite(DIGIT_ONES, DIGIT_OFF);
}

void showDigit(int digit) {
  if (digit < 0 || digit > 9) digit = 0;
  byte pattern = DIGIT_PATTERNS[digit];

  digitalWrite(SEG_A, (pattern & 0b01000000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_B, (pattern & 0b00100000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_C, (pattern & 0b00010000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_D, (pattern & 0b00001000) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_E, (pattern & 0b00000100) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_F, (pattern & 0b00000010) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_G, (pattern & 0b00000001) ? SEG_ON : SEG_OFF);
  digitalWrite(SEG_DP, SEG_OFF);
}

void updateDisplay() {
  if (countdownCars <= 0) {
    clearDisplay();
    return;
  }

  unsigned long now = millis();
  if (now - lastDisplayUpdate < DISPLAY_REFRESH_MS) return;
  lastDisplayUpdate = now;

  static uint8_t digitIndex = 0;
  digitalWrite(DIGIT_TENS, DIGIT_OFF);
  digitalWrite(DIGIT_ONES, DIGIT_OFF);

  int value = 0;
  int digitPin = DIGIT_TENS;
  if (digitIndex == 0) {
    value = (countdownCars / 10) % 10;
    digitPin = DIGIT_TENS;
  } else {
    value = countdownCars % 10;
    digitPin = DIGIT_ONES;
  }

  showDigit(value);
  digitalWrite(digitPin, DIGIT_ON);

  digitIndex = (digitIndex + 1) & 0x01;
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "STOP_TRAFFIC") {
    setStopTraffic();
    Serial.println("TRAFFIC_STOPPED");
  } else if (cmd == "NORMAL_TRAFFIC") {
    setNormalTraffic();
    countdownCars = 0;
    Serial.println("TRAFFIC_NORMAL");
  } else if (cmd == "CAUTION_TRAFFIC") {
    setCautionTraffic();
    Serial.println("TRAFFIC_CAUTION");
  } else if (cmd.startsWith("COUNTDOWN:CARS:")) {
    int value = cmd.substring(15).toInt();
    value = constrain(value, 0, 99);
    countdownCars = value;
  } else if (cmd == "PING") {
    Serial.println("PONG");
  } else if (cmd == "GREEN") {
    setNormalTraffic();
  } else if (cmd == "YELLOW") {
    setCautionTraffic();
  } else if (cmd == "RED") {
    setStopTraffic();
  }
}

void setup() {
  pinMode(TL_GREEN, OUTPUT);
  pinMode(TL_YELLOW, OUTPUT);
  pinMode(TL_RED, OUTPUT);

  pinMode(SEG_A, OUTPUT);
  pinMode(SEG_B, OUTPUT);
  pinMode(SEG_C, OUTPUT);
  pinMode(SEG_D, OUTPUT);
  pinMode(SEG_E, OUTPUT);
  pinMode(SEG_F, OUTPUT);
  pinMode(SEG_G, OUTPUT);
  pinMode(SEG_DP, OUTPUT);

  pinMode(DIGIT_TENS, OUTPUT);
  pinMode(DIGIT_ONES, OUTPUT);

  setNormalTraffic();
  clearDisplay();

  Serial.begin(9600);
  Serial.println("ARDUINO_READY");
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(inputBuffer);
      inputBuffer = "";
    } else {
      inputBuffer += c;
    }
  }

  updateDisplay();
}
```

### What this code does

| Function | Purpose |
|----------|---------|
| `setup()` | Sets all 13 output pins (3 LEDs + 8 segments + 2 digit selects), starts traffic light on **green**, clears the display, opens serial at **9600**, prints `ARDUINO_READY` |
| `loop()` | Reads serial commands + multiplexes the 2-digit 7-segment display (non-blocking) |
| `handleCommand()` | Maps web commands to the traffic light + countdown display |
| `setNormalTraffic()` | Traffic light: Green ON |
| `setCautionTraffic()` | Traffic light: Yellow ON |
| `setStopTraffic()` | Traffic light: Red ON |
| `updateDisplay()` | Multiplexes 2 digits (Cars tens/ones) at ~100 Hz per digit |
| `showDigit()` | Lights segments for a single digit (0-9) |

---

## Serial protocol (must match backend)

| Command (from PC) | Arduino action | Arduino reply |
|-------------------|----------------|---------------|
| `PING` | Health check | `PONG` |
| `CAUTION_TRAFFIC` | Light: Yellow ON | `TRAFFIC_CAUTION` |
| `STOP_TRAFFIC` | Light: Red ON | `TRAFFIC_STOPPED` |
| `NORMAL_TRAFFIC` | Light: Green ON, countdown reset to 0 | `TRAFFIC_NORMAL` |
| `COUNTDOWN:CARS:<sec>` | Sets the display (0-99) | (none) |

Commands are plain text, **one per line**, ending with `\n` (newline).

The sketch also accepts legacy manual commands from the admin dashboard upload flow:

| Command | Action |
|---------|--------|
| `GREEN` | Same as `NORMAL_TRAFFIC` |
| `YELLOW` | Same as `CAUTION_TRAFFIC` |
| `RED` | Same as `STOP_TRAFFIC` |

> The backend also sends `COUNTDOWN:PEDS:<sec>` in the live pipeline; with one display this is **ignored** by the sketch.

**Baud rate:** `9600` (must match backend `.env`).

### Countdown Display Usage

When the backend sends `STOP_TRAFFIC`, it also sends `COUNTDOWN:CARS:15` (or whatever the stop duration is). The display shows the remaining seconds. When the backend sends `NORMAL_TRAFFIC`, the countdown resets to 0 (displays blank/00).

---

## Test the Arduino before connecting the web app

Use the Arduino IDE **Serial Monitor** (9600 baud, **Newline** line ending):

1. Send `PING` → expect `PONG`
2. Confirm boot text includes **`FW_V3`**. If it does not, the new sketch was not uploaded.
3. Send `TEST` → left shows **2** alone, then right shows **3** alone, then **23**, then **03**. If both digits light in the first two steps, pins 7 and 8 are shorted or both wired to the same place (often both to GND).
4. If `TEST` is dark or inverted, send `MODE CA` then `TEST` again.
5. Send `STOP_TRAFFIC` → red LED on → expect `TRAFFIC_STOPPED`
6. Send `COUNTDOWN:CARS:15` → display shows "15"
7. Send `CAUTION_TRAFFIC` → yellow LED on → expect `TRAFFIC_CAUTION`
8. Send `NORMAL_TRAFFIC` → green LED on, display clears → expect `TRAFFIC_NORMAL`

If this works, the hardware and sketch are correct.

---

## Connect to the Node.js backend

### 1. Find your COM port (Windows)

1. Open **Device Manager**
2. Expand **Ports (COM & LPT)**
3. Note the port for **Arduino Uno** (e.g. `COM3`, `COM4`). Many clones use a **CH340 USB chip** and show up as `USB-SERIAL CH340 (COMx)`.

### 2. Configure `backend/.env`

For the **live YOLO pipeline**, set:

```env
YOLO_LIVE_ARDUINO_TRANSPORT=serial
YOLO_LIVE_ARDUINO_PORT=COM4
YOLO_LIVE_ARDUINO_BAUD=9600
```

Replace `COM4` with your actual port. If you also drive the same Arduino from the dashboard signal controls, set:

```env
SIGNAL_TRANSPORT=serial
SIGNAL_SERIAL_PORT=COM4
SIGNAL_BAUD=9600
```

Optional timing (defaults are fine for the thesis demo):

```env
YOLO_LIVE_DETECTION_THRESHOLD_MS=5000
YOLO_LIVE_STOP_DURATION_MS=15000
```

### 3. Run the full stack

Start in separate terminals (see project `START.md`):

1. **Python YOLO** — `yolo-service` → port 8000  
2. **Backend** — `backend` → port 4000  
3. **Frontend** — `frontend` → port 5173  

### 4. Verify on the dashboard

Open **http://localhost:5173** → Dashboard.

| Indicator | Expected when working |
|-----------|------------------------|
| **Arduino** | `online` |
| **Traffic** | `Normal` until a pedestrian is held 5s |
| **Traffic** | `Caution` (yellow) during transition |
| **Traffic** | `Stopped` after sustained detection |
| **Countdown (Cars)** | Shows remaining vehicle stop seconds (2-digit) |
| Green LED | On during normal state |
| Red LED | On during stopped state |

The backend logs Arduino replies such as `TRAFFIC_STOPPED`, `TRAFFIC_CAUTION`, `TRAFFIC_NORMAL`.

---

## End-to-end behavior (live mode)

| Step | What happens |
|------|----------------|
| 1 | Webcam feeds Python YOLO service |
| 2 | Pedestrian detected → backend receives JSON |
| 3 | Pedestrian stays detected **5 seconds** → backend sends `CAUTION_TRAFFIC\n` (yellow 3s) |
| 4 | Traffic light turns **yellow**, reply `TRAFFIC_CAUTION` |
| 5 | After **3 seconds** → backend sends `STOP_TRAFFIC\n` + `COUNTDOWN:CARS:15\n` |
| 6 | Traffic light turns **red**, display shows `15`, reply `TRAFFIC_STOPPED` |
| 7 | Every second → backend sends `COUNTDOWN:CARS:<remaining>\n` |
| 8 | After **15 seconds** → backend sends `NORMAL_TRAFFIC\n` |
| 9 | Traffic light turns **green**, display clears, reply `TRAFFIC_NORMAL` |
| 10 | Dashboard updates live via WebSocket (no page refresh) |

---

## No Arduino yet? (development mode)

Leave serial disabled — commands are printed in the backend terminal only:

```env
YOLO_LIVE_ARDUINO_TRANSPORT=log
```

The dashboard still works; the **Arduino** status may show `offline` until real hardware is connected.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| LED never lights **at all** | Most likely **LED polarity**. Long leg → 220 Ω → Arduino pin; short leg → GND. Flip the LED. Also verify the resistor is between pin and LED, and that the pin is **9 / 10 / 11** |
| Wrong LED lights | Swap wires — you may have green/yellow/red on wrong pins |
| Display shows **33** instead of **03** or **23** (both digits the same) | Digit commons are not switching separately. 1) Re-upload `traffic_light.ino` (`COMMON_CATHODE` must be `true`). 2) Pins **7 and 8 are adjacent** — they must not share a breadboard row. Pin 8 → **A2** only, pin 7 → **A3** only. 3) Send `TEST` in Serial Monitor — it forces `23`. If you still see `33`, the tens cathode is shorted to the ones cathode. |
| Display shows swapped digits (03 looks like 30) | Swap the A2 / A3 wires (tens vs ones). |
| Display shows wrong numbers / a line | Verify display pin mapping: Pin 1=C, Pin 3=E, Pin 4=D, Pin 5=G, Pin 6=F, Pin 9=B, Pin 10=A. Segments and digit pins may be swapped. If every number looks inverted or only a minus sign, set `COMMON_CATHODE` to `false` and re-upload (your module is common-anode). |
| Display is dark | Check the digit common pins: Pin 8 (tens) → A2, Pin 7 (ones) → A3, connected **directly (no resistor)**. Confirm the display is **common cathode**. If still dark after a correct upload, try `COMMON_CATHODE = false`. |
| Web app works, Arduino does not | Close Serial Monitor before starting backend (only one app can use the port) |
| Backend says Arduino offline | Verify `YOLO_LIVE_ARDUINO_PORT`, USB cable, and that the backend runs on the **host PC** (not inside Docker on Windows) |
| Port not listed | Replug USB, install CH340 drivers for clones, try another (non charge-only) cable |
| `TRAFFIC_STOPPED` never sent | Start `yolo-service`, ensure pedestrian is in view for full 5 seconds |
| Baud mismatch | Keep sketch and `.env` at **9600** |

---

## Pin reference (Arduino Uno)

| Pin | Used for | Display Physical Pin |
|-----|----------|---------------------|
| D2 | 7-Segment Segment A | Pin 10 |
| D3 | 7-Segment Segment B | Pin 9 |
| D4 | 7-Segment Segment C | Pin 1 |
| D5 | 7-Segment Segment D | Pin 4 |
| D9 | Traffic Light Green | — |
| D10 | Traffic Light Yellow | — |
| D11 | Traffic Light Red | — |
| D12 | 7-Segment Segment E | Pin 3 |
| D13 | 7-Segment Segment F | Pin 6 |
| A0 (D14) | 7-Segment Segment G | Pin 5 |
| A1 (D15) | 7-Segment Segment DP | Pin 2 |
| A2 (D16) | Display Digit 1 (tens) | Pin 8 |
| A3 (D17) | Display Digit 2 (ones) | Pin 7 |
| GND | All LED cathodes / CC digit commons | — |

Pins **D2–D13, A0–A5** are safe digital outputs on the Uno. Do not use pins **0 (RX)** or **1 (TX)** for LEDs — they are shared with USB serial.

---

## Quick checklist

- [ ] Green LED → **D9**, via 220 Ω to GND (long leg to pin)
- [ ] Yellow LED → **D10**, via 220 Ω to GND
- [ ] Red LED → **D11**, via 220 Ω to GND
- [ ] 7-Segment segments (each through **220 Ω**):
  - Seg A: pin 10 → **D2** · Seg B: pin 9 → **D3** · Seg C: pin 1 → **D4** · Seg D: pin 4 → **D5**
  - Seg E: pin 3 → **D12** · Seg F: pin 6 → **D13** · Seg G: pin 5 → **A0** · DP: pin 2 → **A1**
- [ ] Digit 1 pin 8 (tens) → **A2**, Digit 2 pin 7 (ones) → **A3** (common cathode, direct, no resistor)
- [ ] Sketch uploaded from `backend/arduino/traffic_light/traffic_light.ino`
- [ ] Serial Monitor test: `PING`, `STOP_TRAFFIC`, `COUNTDOWN:CARS:15`, `CAUTION_TRAFFIC`, `NORMAL_TRAFFIC`
- [ ] `backend/.env`: `YOLO_LIVE_ARDUINO_TRANSPORT=serial` and correct `COM` port
- [ ] yolo-service + backend + frontend running
- [ ] Dashboard shows Arduino **online**, traffic light syncs, countdown display shows seconds

For full startup commands, see [`START.md`](../../START.md) in the project root.