# AI-Driven Pedestrian Crosswalk System — Enhanced Localhost Implementation Spec

> **Audience note for the coding agent:**
> This file is a step-by-step build spec with **NEW SECTIONS** on Manual Mode, YOLO Activation Switch, UI Framework, and Taste/Design Guidelines.
> Sections marked **[NEW]** are additions to the original spec.
> Follow steps **in order**. Do not skip ahead. Where marked **FIXED**, do not change. Where **CONFIGURABLE**, read from env.

---

## 0. Project Goal (one paragraph)

Build a **local, real-time** pipeline where a webcam feeds a Python YOLO service, which detects pedestrians using a custom-trained model (`best.pt`), streams the annotated video and detection events to an existing Node.js server. The system operates in **two modes:**

1. **Manual Mode** — An admin manually triggers traffic state (GREEN → YELLOW → RED) with configurable durations (green_sec, yellow_sec, red_sec). No YOLO inference affects the output.
2. **YOLO Activation Mode** — A pedestrian standing in frame for 5 seconds automatically triggers the same state machine with configured durations, overriding manual control until the cycle completes.

The Node.js server relays state to a Vite + Vue dashboard, sends high-level commands over USB serial to an Arduino Uno that physically controls a traffic light + pedestrian walk signals + countdown displays. The frontend uses **PrimeVue** as the UI component library, with custom taste/design for buttons, timers, and status indicators.

This is a **localhost prototype only**. No cloud, no Docker, no auth, no WebRTC, until every milestone below passes.

---

## 0.1 [NEW] Operating Modes

### Mode 1: Manual Control
- **Admin Access Only** — Dashboard lock/unlock, require credentials.
- **Button Array** — Three buttons: `► GREEN`, `► YELLOW`, `► RED`.
- **Timers** — Configurable durations per state:
  - `GREEN_DURATION_MS` (default 30 s) — how long green lasts before manual click returns to normal
  - `YELLOW_DURATION_MS` (default 3 s)
  - `RED_DURATION_MS` (default 20 s)
- **Lock/Unlock UI** — Visual indicator (lock icon) showing whether manual override is active.
- **Fallback to YOLO** — If manual lock expires (timer fires) or admin explicitly unlocks, YOLO takes control again.

### Mode 2: YOLO Activation (Auto)
- **Pedestrian Detection 5 s** → Trigger `STOP_TRAFFIC` (RED + pedestrian walk).
- **Duration** — Respect `RED_DURATION_MS` (20 s default), then auto-return to GREEN.
- **Higher Priority Than Manual** — If a manual override is active (lock) and YOLO detects a pedestrian for 5 s, YOLO's trigger overrides and starts a new cycle.
- **Interruptible** — An admin can interrupt with manual lock at any time.

---

## 1. Non-Negotiable Architectural Rules (FIXED)

1. **React never runs YOLO inference.** React only displays a video stream and JSON state. No `onnxruntime-web`, no TensorFlow.js, no client-side inference.
2. **React never uploads video files for detection.** No file upload flow. The video path is a live stream only.
3. **The Python service is long-running.** It must NOT process one frame and exit. It runs an infinite loop (or async loop) for the lifetime of the process.
4. **Layer responsibilities are fixed:**
   - **Python** → camera capture, YOLO inference, frame annotation, detection JSON, MJPEG video stream.
   - **Node.js** → central state, traffic/pedestrian state machine, manual override lock, 5s/RED timing logic, WebSocket/Socket.io broadcast to Vue, Arduino serial commands, health endpoints.
   - **Vue** → presentation only. Renders the MJPEG stream in an `<img>` tag. Renders WebSocket state. Dispatches manual control events. No business logic beyond UI state.
   - **Arduino** → owns the actual LED/light state machine. Receives high-level commands (`STOP_TRAFFIC`, `NORMAL_TRAFFIC`, `CAUTION_TRAFFIC`, `COUNTDOWN:<sec>`, `PED_GREEN`, `PED_RED`).
5. **Do not let YOLO trigger the Arduino directly.** Python never opens the serial port. Only Node.js talks to Arduino.
6. **Do not implement the 5-second and 15-second timers in Python or React.** They belong in Node.js.
7. **No premature optimization.** Build MJPEG (Option A) first. Do not attempt WebRTC or GPU-streaming optimizations until MJPEG works end-to-end.
8. **Manual mode must not depend on YOLO being online.** If YOLO service is down, manual control still works.

---

## 1.1 [NEW] UI Framework & Design System

### Framework: PrimeVue 4.x + Tailwind CSS
- **Component Library** — PrimeVue (Vue 3 compatible) for buttons, modals, dropdowns, badges, panels.
- **Styling** — Tailwind CSS for utility-first layouts, responsive design, dark mode.
- **Icon Set** — PrimeIcons (built-in with PrimeVue) for traffic lights, lock/unlock, play/stop, timer, pedestrian.
- **Dark Mode** — Automatic via Tailwind dark mode media query + PrimeVue theme toggle.
- **Responsive** — Mobile-first design. Traffic light display = full width on mobile, sidebar on desktop.

### Why PrimeVue?
- Rich, production-ready UI components (Badge, Button, Card, Dropdown, Sidebar).
- Built-in accessibility (ARIA labels, keyboard navigation).
- Theming system (Lara, Soho, Bootstrap themes available; or custom CSS variables).
- Consistent styling across the dashboard.
- No lock-in — components can be replaced if needed.

### Installation (frontend)
```bash
cd frontend
npm install primevue primeicons tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Setup (main.ts)
```typescript
import PrimeVue from 'primevue/config';
import 'primevue/resources/themes/lara-light-blue/theme.css';
import 'primevue/resources/primevue.css';
import 'primeicons/primeicons.css';
import './index.css';  // Tailwind

app.use(PrimeVue);
```

---

## 1.2 [NEW] Taste / Design Guidelines for UI Components

### Button Design (PrimeVue Button)
- **Traffic Control Buttons** — Three large, centered buttons (GREEN / YELLOW / RED).
  - **Active state** — Highlighted with solid background color (green=#10B981, yellow=#FBBF24, red=#EF4444).
  - **Inactive state** — Outlined only, muted text.
  - **Disabled state** (when YOLO lock is active) — Opacity 0.5, cursor not-allowed.
  - **Size** — `lg` (PrimeVue), padding 1rem, icon left + text right.
  - **Font** — 16px bold, uppercase letters (`GREEN`, `YELLOW`, `RED`).
  - **Transition** — Smooth color + shadow on hover (50 ms ease-in-out).
  - **Example markup:**
    ```vue
    <Button 
      label="GREEN" 
      icon="pi pi-play" 
      :severity="manualState === 'GREEN' ? 'success' : 'secondary'"
      :disabled="yoloActivationLock"
      @click="setManualState('GREEN')"
      class="w-full mb-3"
    />
    ```

### Status Badges & Indicators
- **Traffic State Badge** — Large, centered, 48px font, shows current state (GREEN / YELLOW / RED / AUTO).
  - Background color matches the traffic light (green, yellow, red).
  - Text white, bold.
  - Rounded pill shape (border-radius: 9999px).
  - Animated pulse if state is transitioning.
  - **Example:**
    ```vue
    <Badge 
      :value="`${systemState.traffic.toUpperCase()}`" 
      class="p-4 text-2xl font-bold"
      :severity="badgeSeverity(systemState.traffic)"
    />
    ```

- **YOLO Lock Indicator** — Small icon badge (top-right corner of manual panel).
  - Lock icon (`pi-lock` / `pi-unlock`) in primary color.
  - Tooltip: `"YOLO Auto-Mode Active — manual controls disabled"` or `"Manual Override Active — YOLO paused"`.
  - Background: subtle lightened color (e.g., blue-50).
  - **Example:**
    ```vue
    <div class="flex items-center gap-2">
      <i :class="yoloActivationLock ? 'pi pi-lock' : 'pi pi-unlock'"></i>
      <span class="text-sm">{{ yoloActivationLock ? 'YOLO Active' : 'Manual' }}</span>
    </div>
    ```

### Timer Display (7-Segment Style)
- **Font** — DSEG7 Classic (if available via Google Fonts) or monospace fallback.
- **Color** — LED green (#00FF00) on black background.
- **Size** — 2.5rem (mobile) / 4rem (desktop).
- **Padding** — 0.5rem 1rem, border-radius 0.5rem.
- **Values displayed:**
  - During GREEN: `--` (blank)
  - During YELLOW: `3` → `0` (counting down seconds)
  - During RED: `20` → `0` (counting down)
  - After cycle: `--` (blank)
- **Update frequency** — Every 1 second (no partial decimals).
- **Example CSS:**
  ```css
  .timer-display {
    font-family: 'DSEG7 Classic', 'Courier New', monospace;
    font-size: 2.5rem;
    color: #00ff00;
    background: #000;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    display: inline-block;
    min-width: 4ch;
    text-align: center;
  }
  ```

### Card Layouts (PrimeVue Card)
- **Manual Control Card** — Left panel on desktop, full-width on mobile.
  - Header: `Manual Control` icon + lock icon.
  - Content: Three large buttons stacked vertically.
  - Footer: Timer config link (if admin).
  - Shadow: subtle (box-shadow: 0 1px 3px rgba(0,0,0,0.1)).
  - Border: 1px solid #e5e7eb (light gray).

- **YOLO Status Card** — Right panel on desktop, below manual on mobile.
  - Header: `Auto Detection` + YOLO lock badge.
  - Content: Pedestrian count, confidence percentage, detection duration (0–5 s).
  - Graph: Sparkline showing confidence history (optional, using PrimeVue Chart).
  - Status dots: YOLO online (green), YOLO offline (red), Arduino online (green).

- **Live Feed Card** — Full-width above manual/YOLO cards.
  - Content: `<img src="http://localhost:8000/video">` in a responsive container.
  - Aspect ratio: 16:9 (from `padding-bottom: 56.25%` trick or CSS aspect-ratio).
  - Border: 2px solid #d1d5db.

### Typography
- **Heading** (h1, h2) — 22px / 18px, weight 600, color --text-primary.
- **Body** (p, span) — 14px, weight 400, color --text-secondary.
- **Labels** (button, badge) — 12px, weight 500, uppercase, letter-spacing 0.05em.
- **Timer text** — 16px (label) + 2.5rem (value).
- **Line height** — 1.5 for body text, 1.2 for headings.

### Color Palette (Tailwind + PrimeVue theme)
- **Success (Green)** — #10B981 (traffic go, pedestrian walk).
- **Warning (Yellow)** — #FBBF24 (caution).
- **Danger (Red)** — #EF4444 (stop, pedestrian don't walk).
- **Primary (Blue)** — #3B82F6 (links, accents, YOLO indicators).
- **Gray (Neutral)** — #6B7280 (disabled, secondary text).
- **Background** — #FFFFFF (light) / #111827 (dark).
- **Border** — #E5E7EB (light) / #374151 (dark).

### Spacing & Layout
- **Sidebar** (desktop) — 320px fixed width, vertical stack.
- **Main content** — Flex column, gap 1rem (16px) between cards.
- **Card padding** — 1.5rem (24px) inside.
- **Button padding** — 0.75rem 1.5rem (12px 24px).
- **Mobile breakpoint** — Tailwind `md:` (768px+).

### Dark Mode
- **Toggle button** — PrimeVue Sidebar has built-in theme switcher.
- **CSS variables** — PrimeVue theme automatically provides `--surface-*`, `--text-*`, `--border-*`.
- **Fallback** — Tailwind dark mode media query (`@media (prefers-color-scheme: dark)`).

---

## 2. Target Data Flow Diagram (UPDATED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANUAL MODE                                  │
│  Admin clicks button (GREEN/YELLOW/RED) → Manual lock active    │
│  Countdown timer fires → lock releases → YOLO takes control     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
Camera ──► Python YOLO Service (localhost:8000)
              │  ├─ MJPEG video stream  ──────────────┐
              │  └─ Detection JSON (HTTP)             │
              ▼                                        ▼
         Pedestrian Detected 5 s                  React/Vue <img>
         (YOLO Activation)                        
              │                                   Vue Dashboard
              ▼                                   (localhost:5173)
         Node.js Server (localhost:3000)
              │  ├─ Manual lock logic
              │  ├─ Traffic state machine
              │  ├─ 5s detection rule
              │  ├─ RED duration rule
              │  ├─ Broadcasts state over Socket.io
              │  └─ Sends serial commands
              ▼
         Arduino Uno (USB Serial, COM3)
              │
              ├─ Traffic Light LED (RED/YELLOW/GREEN)
              ├─ Pedestrian Walk LED (GREEN for walk, RED for don't walk)
              ├─ Car countdown display (7-segment × 2)
              └─ Pedestrian countdown display (7-segment × 2)
```

---

## 2.1 [NEW] Manual Override State Machine (Node.js)

```
┌─────────────┐
│   NORMAL    │  Default state. YOLO can trigger.
│  (GREEN)    │
└──────┬──────┘
       │ Manual: Click GREEN button
       ▼
┌─────────────┐
│  MANUAL_    │  Manual lock ACTIVE.
│  ACTIVE     │  Timer running (30 s default).
│  (GREEN)    │  YOLO cannot trigger.
└──────┬──────┘
       │ Manual lock timer expires
       ▼
┌─────────────┐
│   NORMAL    │  Lock released. YOLO can trigger again.
│  (GREEN)    │
└─────────────┘

       OR (if admin clicks YELLOW)
       
┌─────────────────┐
│  MANUAL_ACTIVE  │
│  (YELLOW) → RED │  Sequence: YELLOW 3s → RED 20s → GREEN
└─────────────────┘
       │ Complete cycle
       ▼
┌─────────────┐
│   NORMAL    │  Lock released.
│  (GREEN)    │
└─────────────┘

       OR (if YOLO detection fires DURING manual lock)

┌──────────────────────────┐
│   MANUAL_ACTIVE (locked) │  YOLO still publishing detection JSON.
└────────────┬─────────────┘
             │ Pedestrian detected ≥5s (YOLO says so)
             │ AND manual lock expires (or admin cancels)
             ▼
       ┌──────────────────┐
       │ YOLO_TRIGGERED   │  YOLO takes control.
       │ (RED) for 20s    │  Manual lock released.
       └──────────────────┘
             │ 20s elapsed
             ▼
       ┌─────────────┐
       │   NORMAL    │
       │  (GREEN)    │
       └─────────────┘
```

---

## 3. Repository Structure (UPDATED)

```
project/
├── frontend/                 # Vite + Vue 3 + PrimeVue
│   ├── src/
│   │   ├── components/
│   │   │   ├── ManualControlCard.vue      # Manual button panel
│   │   │   ├── YoloStatusCard.vue         # YOLO detection panel
│   │   │   ├── TimerDisplayCard.vue       # 7-segment timer display
│   │   │   ├── LiveFeedCard.vue           # MJPEG stream container
│   │   │   └── SystemStatusBadge.vue      # State indicator
│   │   ├── composables/
│   │   │   ├── useLiveSystemState.ts      # Socket.io connection + state
│   │   │   └── useManualControl.ts        # Manual lock/unlock logic
│   │   ├── types.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── tailwind.config.js                 # Tailwind + PrimeVue theme
│   ├── postcss.config.js
│   └── package.json
│
├── server/                   # Node.js + Express
│   ├── src/
│   │   ├── services/
│   │   │   ├── yoloLive.service.ts        # YOLO detection handler
│   │   │   ├── trafficSignal.service.ts   # State machine + manual mode
│   │   │   ├── arduinoSerial.ts           # Serial port + commands
│   │   │   └── socketIoBroadcaster.ts     # Socket.io events
│   │   ├── routes/
│   │   │   ├── signal.routes.ts           # Manual control endpoints
│   │   │   └── health.routes.ts           # Health check endpoints
│   │   ├── config/
│   │   │   └── env.ts                     # Environment schema
│   │   ├── types/
│   │   │   └── index.ts                   # Shared types (Signal, Traffic, Pedestrian)
│   │   └── server.ts                      # Express app + Socket.io
│   ├── .env
│   └── package.json
│
├── yolo-service/             # Python FastAPI
│   ├── app.py                # FastAPI app: /video, /health, detection publishing
│   ├── detector.py           # YOLO model loading + inference wrapper
│   ├── camera.py             # Camera capture loop
│   ├── requirements.txt
│   ├── .env
│   └── models/
│       └── best.pt           # Trained custom YOLO model
│
└── README.md
```

---

## 4–9. [UNCHANGED] Python Setup, Validation, JSON Contract, Camera, Detector, FastAPI

*(Sections 4–9 remain identical to the original spec. Refer to original document.)*

---

## 10. [UPDATED] Node.js Server Integration — Manual Mode + YOLO Activation

### 10.1 System State (UPDATED with manual mode)

```typescript
interface SystemState {
  // Traffic & Pedestrian State
  traffic: 'GREEN' | 'YELLOW' | 'RED';
  pedestrianState: 'WALK' | 'DONT_WALK';
  
  // Timers (seconds remaining)
  trafficTimerSec: number | null;      // null = "not active"
  pedestrianTimerSec: number | null;
  
  // YOLO Detection
  yoloOnline: boolean;
  pedestrianDetected: boolean;
  pedestrianCount: number;
  pedestrianConfidence: number;
  detectionDurationSec: number;        // How long pedestrian has been visible (0–5)
  
  // Manual Mode State
  manualLock: boolean;                 // Is manual mode active?
  manualLockExpiresSec: number | null; // Countdown before lock releases
  controlledBy: 'MANUAL' | 'YOLO' | 'NONE';  // Who triggered current state?
  
  // Hardware Health
  arduinoOnline: boolean;
  cameraOnline: boolean;
}
```

### 10.2 Configuration (NEW SECTION)

Add to `backend/.env`:

```env
# Traffic Light Timing (milliseconds)
TRAFFIC_GREEN_DURATION_MS=30000
TRAFFIC_YELLOW_DURATION_MS=3000
TRAFFIC_RED_DURATION_MS=20000

# YOLO Detection Timing
YOLO_PEDESTRIAN_THRESHOLD_MS=5000      # Pedestrian must be visible for 5 seconds
YOLO_DETECTION_PUBLISH_INTERVAL_MS=200 # Publish detection JSON every 200ms

# Manual Mode
MANUAL_LOCK_TIMEOUT_MS=60000            # Manual lock expires after 60 s
MANUAL_MODE_ENABLED=true
YOLO_MODE_ENABLED=true                 # Can both be true: manual takes priority
```

### 10.3 Manual Control Route Handlers (NEW SECTION)

```typescript
// POST /api/signal/manual/green
// POST /api/signal/manual/yellow
// POST /api/signal/manual/red
// POST /api/signal/manual/unlock

app.post("/api/signal/manual/:action", authenticate, (req, res) => {
  const action = req.params.action; // 'green' | 'yellow' | 'red' | 'unlock'
  
  if (action === 'unlock') {
    trafficSignalService.releaseManualLock();
    res.json({ success: true, state: systemState });
    return;
  }
  
  // Else: green/yellow/red
  const durationMs = 
    action === 'green' ? GREEN_DURATION_MS :
    action === 'yellow' ? YELLOW_DURATION_MS + RED_DURATION_MS :
    RED_DURATION_MS;
  
  trafficSignalService.setManualLock(action.toUpperCase(), durationMs);
  res.json({ success: true, state: systemState });
});
```

### 10.4 Traffic Signal Service (NEW STATE MACHINE)

```typescript
class TrafficSignalService {
  private manualLockActive: boolean = false;
  private manualLockExpiresAt: number | null = null;
  private detectionStartedAt: number | null = null;
  private yoloCanTrigger: boolean = true;
  
  // Called by manual control endpoint
  setManualLock(state: 'GREEN' | 'YELLOW' | 'RED', durationMs: number) {
    this.manualLockActive = true;
    this.yoloCanTrigger = false;
    this.manualLockExpiresAt = Date.now() + durationMs;
    
    if (state === 'GREEN') {
      this.transitionTraffic('GREEN');
    } else if (state === 'YELLOW') {
      this.transitionTraffic('YELLOW');
      setTimeout(() => this.transitionTraffic('RED'), YELLOW_DURATION_MS);
      setTimeout(() => this.releaseManualLock(), YELLOW_DURATION_MS + RED_DURATION_MS);
    } else if (state === 'RED') {
      this.transitionTraffic('RED');
      setTimeout(() => this.releaseManualLock(), RED_DURATION_MS);
    }
    
    this.broadcastState();
  }
  
  releaseManualLock() {
    this.manualLockActive = false;
    this.manualLockExpiresAt = null;
    this.yoloCanTrigger = true;
    this.detectionStartedAt = null;
    this.transitionTraffic('GREEN');
    this.broadcastState();
  }
  
  // Called by YOLO detection handler
  handleYoloDetection(detectionPayload: DetectionJSON) {
    const now = Date.now();
    systemState.yoloOnline = true;
    systemState.pedestrianDetected = detectionPayload.detected;
    systemState.pedestrianCount = detectionPayload.count;
    systemState.pedestrianConfidence = detectionPayload.detections[0]?.confidence ?? 0;
    
    // Update manual lock countdown
    if (this.manualLockActive && this.manualLockExpiresAt) {
      systemState.manualLockExpiresSec = Math.max(0, 
        Math.ceil((this.manualLockExpiresAt - now) / 1000)
      );
      if (systemState.manualLockExpiresSec === 0) {
        this.releaseManualLock();
        return; // Bail, re-enter after lock released
      }
    }
    
    // YOLO logic (only if manual lock is NOT active)
    if (!this.manualLockActive && this.yoloCanTrigger) {
      if (detectionPayload.detected) {
        if (this.detectionStartedAt === null) {
          this.detectionStartedAt = now;
        }
        systemState.detectionDurationSec = (now - this.detectionStartedAt) / 1000;
        
        if (systemState.detectionDurationSec >= 5) {
          this.triggerYoloTrafficStop();
        }
      } else {
        this.detectionStartedAt = null;
        systemState.detectionDurationSec = 0;
      }
    }
    
    this.broadcastState();
  }
  
  triggerYoloTrafficStop() {
    this.manualLockActive = true;
    this.yoloCanTrigger = false;
    systemState.controlledBy = 'YOLO';
    
    this.transitionTraffic('YELLOW');
    setTimeout(() => this.transitionTraffic('RED'), YELLOW_DURATION_MS);
    setTimeout(() => this.releaseManualLock(), YELLOW_DURATION_MS + RED_DURATION_MS);
  }
  
  transitionTraffic(state: 'GREEN' | 'YELLOW' | 'RED') {
    systemState.traffic = state;
    
    // Send Arduino command
    const cmd = state === 'GREEN' ? 'NORMAL_TRAFFIC' :
                state === 'YELLOW' ? 'CAUTION_TRAFFIC' :
                'STOP_TRAFFIC';
    arduinoSerial.send(cmd);
    
    // Set pedestrian state
    systemState.pedestrianState = state === 'RED' ? 'WALK' : 'DONT_WALK';
    
    // Set timer countdown
    if (state === 'YELLOW') {
      systemState.trafficTimerSec = YELLOW_DURATION_MS / 1000;
      this.countdownTimer('traffic', YELLOW_DURATION_MS);
    } else if (state === 'RED') {
      systemState.trafficTimerSec = RED_DURATION_MS / 1000;
      systemState.pedestrianTimerSec = RED_DURATION_MS / 1000;
      this.countdownTimer('both', RED_DURATION_MS);
    } else {
      systemState.trafficTimerSec = null;
      systemState.pedestrianTimerSec = null;
    }
  }
  
  private countdownTimer(type: 'traffic' | 'pedestrian' | 'both', durationMs: number) {
    const startAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startAt;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      
      if (type === 'traffic' || type === 'both') {
        systemState.trafficTimerSec = remaining;
      }
      if (type === 'pedestrian' || type === 'both') {
        systemState.pedestrianTimerSec = remaining;
      }
      
      this.broadcastState();
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);
  }
  
  broadcastState() {
    socketIo.to('dashboard').emit('system:state', systemState);
  }
}
```

### 10.5 WebSocket Events (Socket.io)

**Server → Client:**
```typescript
signalIo.to('dashboard').emit('system:state', systemState);
```

**Client → Server:**
```typescript
socket.emit('ui:manual/green', {}, (ack) => { /* handle */ });
socket.emit('ui:manual/yellow', {}, (ack) => { /* handle */ });
socket.emit('ui:manual/red', {}, (ack) => { /* handle */ });
socket.emit('ui:manual/unlock', {}, (ack) => { /* handle */ });
```

---

## 11. [UNCHANGED] Arduino Serial Integration

*(Sections 11–12 remain identical to original spec.)*

---

## 13. [UPDATED] React/Vue Integration

### 13.1 Vue 3 + PrimeVue Setup

**frontend/src/main.ts:**
```typescript
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Badge from 'primevue/badge'
import Panel from 'primevue/panel'
import Tooltip from 'primevue/tooltip'
import 'primevue/resources/themes/lara-light-blue/theme.css'
import 'primevue/resources/primevue.css'
import 'primeicons/primeicons.css'
import './index.css'  // Tailwind

import App from './App.vue'

const app = createApp(App)
app.use(PrimeVue)
app.component('Button', Button)
app.component('Card', Card)
app.component('Badge', Badge)
app.component('Panel', Panel)
app.directive('tooltip', Tooltip)

app.mount('#app')
```

### 13.2 Composable: useLiveSystemState.ts

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { SystemState } from '../types'

export function useLiveSystemState() {
  const state = ref<SystemState | null>(null)
  const connected = ref(false)
  let socket: Socket | null = null

  onMounted(() => {
    socket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    })

    socket.on('connect', () => {
      connected.value = true
      console.log('Connected to Signal server')
    })

    socket.on('disconnect', () => {
      connected.value = false
      console.log('Disconnected from Signal server')
    })

    socket.on('system:state', (payload: SystemState) => {
      state.value = payload
    })

    socket.emit('ui:subscribe', { room: 'dashboard' })
  })

  onUnmounted(() => {
    socket?.disconnect()
  })

  const manualGreen = () => {
    socket?.emit('ui:manual/green', {}, (ack: any) => {
      console.log('Green ack:', ack)
    })
  }

  const manualYellow = () => {
    socket?.emit('ui:manual/yellow', {}, (ack: any) => {
      console.log('Yellow ack:', ack)
    })
  }

  const manualRed = () => {
    socket?.emit('ui:manual/red', {}, (ack: any) => {
      console.log('Red ack:', ack)
    })
  }

  const manualUnlock = () => {
    socket?.emit('ui:manual/unlock', {}, (ack: any) => {
      console.log('Unlock ack:', ack)
    })
  }

  return {
    state,
    connected,
    manualGreen,
    manualYellow,
    manualRed,
    manualUnlock,
  }
}
```

### 13.3 Component: ManualControlCard.vue

```vue
<template>
  <Card class="manual-card">
    <template #header>
      <div class="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900">
        <span class="font-bold text-lg">
          <i class="pi pi-hand-open-fill mr-2"></i>Manual Control
        </span>
        <Badge 
          v-if="state?.manualLock"
          :value="`${state.manualLockExpiresSec}s`"
          severity="warning"
        />
      </div>
    </template>

    <div class="space-y-3 p-4">
      <!-- GREEN Button -->
      <Button 
        label="GREEN" 
        icon="pi pi-play"
        :severity="state?.traffic === 'GREEN' ? 'success' : 'secondary'"
        :disabled="!state || (state?.manualLock && state?.controlledBy === 'YOLO')"
        @click="manualGreen"
        class="w-full"
        size="large"
      />

      <!-- YELLOW Button -->
      <Button 
        label="YELLOW" 
        icon="pi pi-circle-fill"
        :severity="state?.traffic === 'YELLOW' ? 'warning' : 'secondary'"
        :disabled="!state || (state?.manualLock && state?.controlledBy === 'YOLO')"
        @click="manualYellow"
        class="w-full"
        size="large"
      />

      <!-- RED Button -->
      <Button 
        label="RED" 
        icon="pi pi-stop-circle"
        :severity="state?.traffic === 'RED' ? 'danger' : 'secondary'"
        :disabled="!state || (state?.manualLock && state?.controlledBy === 'YOLO')"
        @click="manualRed"
        class="w-full"
        size="large"
      />

      <!-- UNLOCK Button (shown only if manual lock is active) -->
      <Button 
        v-if="state?.manualLock"
        label="UNLOCK" 
        icon="pi pi-lock-open"
        severity="warning"
        @click="manualUnlock"
        class="w-full mt-4"
      />
    </div>

    <!-- Status line -->
    <template #footer>
      <div class="text-center text-sm text-gray-500 dark:text-gray-400 p-4">
        <span v-if="!state?.manualLock">Ready for manual or auto control</span>
        <span v-else-if="state?.controlledBy === 'MANUAL'">
          Manual lock active — {{ state.manualLockExpiresSec }}s remaining
        </span>
        <span v-else-if="state?.controlledBy === 'YOLO'">
          YOLO auto-triggered — manual controls locked
        </span>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { useLiveSystemState } from '../composables/useLiveSystemState'

const { state, manualGreen, manualYellow, manualRed, manualUnlock } = useLiveSystemState()
</script>

<style scoped>
.manual-card {
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
```

### 13.4 Component: TimerDisplayCard.vue

```vue
<template>
  <div class="timer-container">
    <div class="timer-row">
      <span class="timer-label">CAR:</span>
      <span class="timer-display">
        {{ state?.trafficTimerSec !== null ? String(state.trafficTimerSec).padStart(2, '0') : '--' }}
      </span>
    </div>
    <div class="timer-row">
      <span class="timer-label">PED:</span>
      <span class="timer-display">
        {{ state?.pedestrianTimerSec !== null ? String(state.pedestrianTimerSec).padStart(2, '0') : '--' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLiveSystemState } from '../composables/useLiveSystemState'

const { state } = useLiveSystemState()
</script>

<style scoped>
.timer-container {
  display: flex;
  gap: 2rem;
  justify-content: center;
  padding: 1rem;
}

.timer-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.timer-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 2.5rem;
}

.timer-display {
  font-family: 'DSEG7 Classic', 'Courier New', monospace;
  font-size: 2.5rem;
  color: #00ff00;
  background: #000;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: inline-block;
  min-width: 4.5ch;
  text-align: center;
  letter-spacing: 0.1em;
}

@media (max-width: 768px) {
  .timer-display {
    font-size: 1.75rem;
  }
  .timer-container {
    gap: 1rem;
  }
}
</style>
```

### 13.5 Component: YoloStatusCard.vue

```vue
<template>
  <Card class="yolo-card">
    <template #header>
      <div class="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900">
        <span class="font-bold text-lg">
          <i class="pi pi-eye mr-2"></i>Auto Detection (YOLO)
        </span>
        <div class="flex gap-2">
          <Badge
            v-if="state?.yoloOnline"
            value="ONLINE"
            severity="success"
            size="small"
          />
          <Badge
            v-else
            value="OFFLINE"
            severity="danger"
            size="small"
          />
        </div>
      </div>
    </template>

    <div class="space-y-3 p-4">
      <div class="stat-row">
        <span class="stat-label">Pedestrian Detected:</span>
        <Badge
          :value="state?.pedestrianDetected ? 'YES' : 'NO'"
          :severity="state?.pedestrianDetected ? 'success' : 'secondary'"
        />
      </div>

      <div class="stat-row">
        <span class="stat-label">Count:</span>
        <span class="font-bold">{{ state?.pedestrianCount ?? 0 }}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">Confidence:</span>
        <span class="font-bold">{{ (state?.pedestrianConfidence ?? 0).toFixed(2) }}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">Detection Duration:</span>
        <ProgressBar
          :value="(state?.detectionDurationSec ?? 0) * 20"
          :show-value="false"
          class="w-full"
        />
        <span class="text-sm ml-2">{{ (state?.detectionDurationSec ?? 0).toFixed(1) }}s / 5s</span>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { useLiveSystemState } from '../composables/useLiveSystemState'

const { state } = useLiveSystemState()
</script>

<style scoped>
.yolo-card {
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
```

### 13.6 Main Dashboard Layout (App.vue)

```vue
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          <i class="pi pi-traffic-light mr-2"></i>Pedestrian Crosswalk Control
        </h1>
      </header>

      <!-- Live Feed -->
      <Card class="mb-6">
        <template #header>
          <div class="p-4 bg-gray-100 dark:bg-gray-800">
            <span class="font-bold">Live YOLO Feed</span>
          </div>
        </template>
        <div class="aspect-video overflow-hidden rounded-lg bg-black">
          <img
            src="http://localhost:8000/video"
            alt="Live YOLO Feed"
            class="w-full h-full object-cover"
          />
        </div>
      </Card>

      <!-- Grid: Manual + YOLO + Timers -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Manual Control (left) -->
        <ManualControlCard />

        <!-- YOLO Status (right) -->
        <YoloStatusCard />
      </div>

      <!-- Timers (full width) -->
      <Card>
        <template #header>
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900">
            <span class="font-bold">Countdown Timers</span>
          </div>
        </template>
        <TimerDisplayCard />
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import ManualControlCard from './components/ManualControlCard.vue'
import YoloStatusCard from './components/YoloStatusCard.vue'
import TimerDisplayCard from './components/TimerDisplayCard.vue'
</script>

<style scoped>
:deep(.p-card) {
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
```

---

## 14. Ports & Startup Order (UNCHANGED from original)

---

## 15. Development Milestones (UPDATED)

1. **Python YOLO standalone** — Camera → model → bounding boxes in OpenCV window.
2. **Python live stream** — `/video` works in browser.
3. **Node.js health endpoints** — `/health`, `/api/system/status` respond.
4. **Manual mode routes** — POST `/api/signal/manual/{green,yellow,red,unlock}` work via curl.
5. **Manual state machine** — Traffic transitions, timers countdown, lock expires.
6. **Vue + PrimeVue setup** — Import components, stylesheet, basic page renders.
7. **Vue Socket.io connection** — Receives `system:state` events, updates UI.
8. **Manual buttons in Vue** — Click GREEN/YELLOW/RED, UI locks, timers count down.
9. **Live MJPEG stream in Vue** — `<img>` displays Python feed.
10. **YOLO detection events** — Python sends JSON → Node.js receives → broadcasts to Vue.
11. **YOLO 5-second rule** — Sustained detection (5s) triggers YOLO traffic stop (yellow → red).
12. **Manual override precedence** — Manual lock prevents YOLO trigger; after lock expires, YOLO can trigger again.
13. **Arduino integration** — Manual/YOLO commands sent over serial, traffic light + pedestrian LEDs respond.
14. **7-segment displays** — Car countdown + pedestrian countdown display correctly.
15. **Full-stack test** — All components together, end-to-end.

---

## 16. Full-System Testing Checklist (UPDATED)

**Python**
- [ ] Model loads, camera opens, inference continuous
- [ ] Bounding boxes correct, confidence values sane
- [ ] Detection JSON matches contract
- [ ] Service survives Node.js offline

**Node.js**
- [ ] Starts cleanly, health endpoint responds
- [ ] Manual routes work via curl (manual lock/unlock)
- [ ] YOLO detection POSTs received and processed
- [ ] Manual lock prevents YOLO trigger
- [ ] Manual lock timer expires, YOLO can trigger again
- [ ] Socket.io broadcasts `system:state` to Vue
- [ ] Arduino commands sent correctly

**Vue + PrimeVue**
- [ ] Components render without errors
- [ ] Socket.io connects, receives state updates
- [ ] Manual buttons trigger correct Socket.io events
- [ ] Live feed displays
- [ ] Timer displays update every second
- [ ] YOLO status badge shows detection count/confidence
- [ ] Manual lock countdown shows when active

**Arduino**
- [ ] PING → PONG
- [ ] NORMAL_TRAFFIC → green LED
- [ ] CAUTION_TRAFFIC → yellow LED
- [ ] STOP_TRAFFIC → red LED
- [ ] COUNTDOWN:<sec> updates 7-segment display
- [ ] PED_GREEN → pedestrian green LED
- [ ] PED_RED → pedestrian red LED

**End-to-End**
- [ ] Manual GREEN → traffic turns green, timers blank
- [ ] Manual YELLOW → yellow (3s) → red (20s) → back to green
- [ ] Manual UNLOCK → manual lock released
- [ ] YOLO detects pedestrian (5s) → YELLOW → RED → stays RED for 20s → GREEN
- [ ] During YOLO cycle, manual buttons disabled
- [ ] All state changes reflected in Vue UI in real-time
- [ ] No missed timer updates
- [ ] No serial port errors
- [ ] Docker/WSL users: confirm USB serial passthrough works

---

## 17. Out of Scope (UNCHANGED)

---

## 18. Next Action for Agent

1. Create `yolo-service/` directory and Python venv.
2. Install dependencies.
3. Run `_validate.py` and confirm `model.names`.
4. Create `frontend/` with Tailwind + PrimeVue setup.
5. Report back with checkpoint confirmations.

Do not proceed to Node.js manual mode implementation until Python validation and frontend setup are confirmed.

---

## 19–33. [EXTENDED HARDWARE SECTIONS] (UNCHANGED from original)

*(Sections 19–33 remain identical, covering Arduino sketch updates, 74HC595 shift registers, 7-segment multiplexing, etc.)*

---

## 34. [NEW] UI Taste Guidelines — Detailed Button Styling

### Button States (PrimeVue Button component)

**Primary Button (Manual Control)**
```vue
<Button 
  label="GREEN" 
  icon="pi pi-play" 
  severity="success"
  :disabled="isYoloLocked"
  @click="handleGreen"
  class="w-full mb-3 text-base font-bold uppercase"
  size="large"
  style="padding: 1rem; letter-spacing: 0.05em;"
/>
```

- **Enabled state (primary):** 
  - Background: `#10B981` (success green)
  - Text: white
  - Border: none
  - Icon: left-aligned, 20px
  - Shadow: `0 4px 6px rgba(0, 0, 0, 0.1)` on hover
  - Transition: `all 150ms ease-in-out`
  
- **Enabled state (secondary):**
  - Background: `#E5E7EB` (light gray)
  - Text: `#374151` (dark gray)
  - Border: `1px solid #D1D5DB`
  - Icon: left-aligned
  - Shadow: `0 1px 2px rgba(0, 0, 0, 0.05)`
  
- **Disabled state:**
  - Opacity: `0.5`
  - Cursor: `not-allowed`
  - Shadow: none
  - Hover: no effect

- **Active state (currently selected):**
  - Scale: `1.02x` (slight zoom)
  - Shadow: `0 8px 12px rgba(16, 185, 129, 0.3)` (success color glow)

### Badge Styling (Status indicators)

**Traffic State Badge:**
```vue
<Badge 
  :value="state.traffic.toUpperCase()" 
  :severity="traffic === 'GREEN' ? 'success' : traffic === 'YELLOW' ? 'warning' : 'danger'"
  class="p-4 text-2xl font-bold"
  style="border-radius: 9999px; letter-spacing: 0.05em;"
/>
```

- **GREEN Badge:**
  - Background: `#DCFCE7` (success light)
  - Text: `#166534` (success dark)
  - Border: `2px solid #86EFAC`

- **YELLOW Badge:**
  - Background: `#FEF3C7` (warning light)
  - Text: `#92400E` (warning dark)
  - Border: `2px solid #FCD34D`

- **RED Badge:**
  - Background: `#FEE2E2` (danger light)
  - Text: `#991B1B` (danger dark)
  - Border: `2px solid #FECACA`

- **Animation:** Pulse on hover (opacity 0.8 → 1.0, 2 s cycle)

### Icon Styling

- **Size:** 20px (buttons) / 24px (headers) / 16px (inline)
- **Color:** Inherit from parent text color
- **Margin:** 8px right of text
- **Line height:** 1 (tight, no extra vertical space)

### Card Styling (Manual + YOLO + Timer cards)

**Header:**
- Background: Linear gradient (left-to-right)
  - Manual card: `#DBEAFE` → `#E0E7FF` (blue to indigo light)
  - YOLO card: `#F3E8FF` → `#DBEAFE` (purple to blue light)
  - Timer card: `#FEF3C7` → `#FED7AA` (yellow to amber light)
- Text: Bold, 16px, color = darker shade of gradient
- Padding: 16px
- Border-bottom: `1px solid #D1D5DB`

**Body:**
- Background: white (light) / `#1F2937` (dark mode)
- Padding: 24px
- Line height: 1.6

**Footer:**
- Background: `#F9FAFB` (light) / `#111827` (dark)
- Text: 12px, muted color
- Padding: 16px
- Border-top: `1px solid #E5E7EB` (light) / `#374151` (dark)

### Responsive Breakpoints

- **Mobile** (< 768px):
  - Single-column layout
  - Button: 44px min height (touch-friendly)
  - Font: 14px → 16px (avoid mobile zoom)
  - Padding: 12px → 16px
  
- **Tablet** (768px – 1024px):
  - 2-column grid (Manual + YOLO side-by-side)
  - Button: 48px height
  - Font: 15px
  
- **Desktop** (> 1024px):
  - 3-column layout (Live Feed + Manual + YOLO)
  - Button: 52px height
  - Font: 16px
  - Sidebar: 320px fixed width (if needed)

### Dark Mode

- Toggle via PrimeVue theme switcher (if implemented).
- CSS variables from PrimeVue theme handle most colors automatically.
- Custom CSS:
  ```css
  @media (prefers-color-scheme: dark) {
    .timer-display {
      background: #000;
      color: #00ff00;
    }
  }
  ```

---

## 35. [NEW] Configuration Reference

### Environment Variables (backend/.env)

```env
# ==== SERVER ====
NODE_ENV=development
PORT=3000

# ==== TRAFFIC LIGHT TIMING (milliseconds) ====
TRAFFIC_GREEN_DURATION_MS=30000      # 30 seconds
TRAFFIC_YELLOW_DURATION_MS=3000      # 3 seconds
TRAFFIC_RED_DURATION_MS=20000        # 20 seconds

# ==== YOLO DETECTION ====
YOLO_SERVICE_URL=http://localhost:8000
YOLO_PEDESTRIAN_THRESHOLD_MS=5000    # Pedestrian must be visible 5s to trigger
YOLO_DETECTION_PUBLISH_INTERVAL_MS=200  # Check detection every 200ms

# ==== MANUAL MODE ====
MANUAL_MODE_ENABLED=true
MANUAL_LOCK_TIMEOUT_MS=60000         # Manual lock expires after 60s
YOLO_MODE_ENABLED=true               # Can both be true; manual takes priority

# ==== ARDUINO SERIAL ====
ARDUINO_PORT=COM3                    # Windows: COM3, COM4, etc.
ARDUINO_BAUD=9600
ARDUINO_CONNECT_TIMEOUT_MS=5000

# ==== SOCKET.IO ====
SOCKET_IO_PATH=/socket.io
SOCKET_IO_RECONNECT_DELAY=1000
SOCKET_IO_MAX_HTTP_BUFFER_SIZE=1e6
```

### Environment Variables (yolo-service/.env)

```env
YOLO_MODEL=models/best.pt
CAMERA_INDEX=0
PYTHON_PORT=8000
NODE_SERVER_URL=http://localhost:3000
CONFIDENCE_THRESHOLD=0.5
DETECTION_PUBLISH_INTERVAL_MS=200
```

### Environment Variables (frontend/.env)

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_IO_URL=http://localhost:3000
VITE_YOLO_STREAM_URL=http://localhost:8000/video
```

---

## 36. [NEW] Troubleshooting Guide

### Issue: Manual buttons disabled but manual lock not active

**Cause:** YOLO has triggered (`controlledBy === 'YOLO'`), and the lock is still active.

**Fix:** Check Node.js logs for `detectionDurationSec >= 5`. Verify that pedestrian has left the frame for 5+ seconds. Manual lock should expire after `RED_DURATION_MS`.

### Issue: YOLO detection not triggering traffic stop

**Cause:**
1. YOLO service offline (no detection JSON being received).
2. Manual lock still active (YOLO trigger is gated by `yoloCanTrigger`).
3. Confidence threshold too high (detections filtered out before reaching Node.js).

**Fix:**
1. Check Python logs: `http://localhost:8000/health` should return `online`.
2. Check Node.js logs for `handleYoloDetection` calls.
3. Lower `CONFIDENCE_THRESHOLD` in `.env` or increase `YOLO_MODEL` training accuracy.

### Issue: 7-segment display shows garbage or not updating

**Cause:** Arduino hasn't received `SET_CAR_TIMER` or `SET_PED_TIMER` command.

**Fix:**
1. Check Node.js logs for `arduinoSerial.send('SET_CAR_TIMER ...')`.
2. Verify Arduino firmware includes the new command handler.
3. Test manually via Serial Monitor: send `SET_CAR_TIMER 15`.

### Issue: Vue component not updating when state changes

**Cause:** Socket.io event not received or Vue reactivity lost.

**Fix:**
1. Check browser DevTools → Network → WebSocket frames (look for `system:state` messages).
2. Check Vue DevTools → state object (is it updating?).
3. Ensure `useLiveSystemState()` composable is imported in the component.
4. Verify Node.js is running and not throwing errors on `socketIo.to('dashboard').emit()`.

---

## 37. [NEW] Performance & Optimization Notes

### Frame Rate & Latency
- **Python MJPEG:** ~30 FPS (depends on camera + model inference time).
- **Detection JSON publish:** Every 200ms (5/sec).
- **Node.js state broadcast:** Every state change + every timer tick (1/sec during countdown).
- **Vue re-render:** Debounced to 200ms for timer display (use `useDebounceFn` if needed).

### Memory Usage
- **Python:** ~500 MB (YOLO model loaded in VRAM if GPU, CPU fallback ~1 GB).
- **Node.js:** ~50 MB (minimal; Socket.io connections are lightweight).
- **Vue:** ~20 MB (in-browser state only).
- **Arduino:** ~2 KB (SRAM); sketch < 20 KB.

### Scaling Beyond Single Crosswalk
- Add route prefix: `/api/signal/:crosswalkId/` (now includes DB lookup for config).
- Multiple Python services (one per camera angle) → deduplicate detections with NMS.
- Multiple Arduino boards over USB (Windows: COM3, COM4, ...; Linux: /dev/ttyUSB0, /dev/ttyUSB1, ...).
- Scale backend to multiple Node.js processes with Redis state sharing (out of scope for localhost).

---

## 38. [NEW] Deployment Checklist (When Ready)

*(This is post-localhost; include here for reference.)*

- [ ] Environment variables set for production (not localhost URLs).
- [ ] HTTPS enabled (Node.js + Vue).
- [ ] WebSocket WSS (secure) or polling fallback.
- [ ] Docker images built (python, node, optional frontend if serving from Node).
- [ ] Docker Compose orchestration (if multi-container).
- [ ] Secrets management (API keys, JWT, etc.) via environment.
- [ ] Logging to file / ELK stack.
- [ ] Metrics collection (Prometheus + Grafana optional).
- [ ] Health checks in CI/CD pipeline.
- [ ] Load testing (k6, JMeter) for multi-crosswalk scaling.

---

## 39. [NEW] Immediate Next Action for Agent

### Phase 1: Python Validation (Do This First)
1. Create `yolo-service/` directory.
2. Set up Python venv, install dependencies.
3. Run `_validate.py`, confirm `model.names`, bounding boxes appear.
4. **Report:** Screenshot of bounding boxes + `model.names` output.

### Phase 2: Frontend Setup (Do This After Phase 1 Passes)
1. Create `frontend/` Vite + Vue 3 project (if not already present).
2. Install PrimeVue, Tailwind CSS, Socket.io-client.
3. Set up basic Tailwind config + PrimeVue theme.
4. Create stub `App.vue` that imports a PrimeVue Button, verify it renders.
5. **Report:** Screenshot of dashboard with at least one PrimeVue Button visible.

### Phase 3: Node.js Manual Mode (Do After Phase 2)
1. Extend `server/` with manual control routes (`/api/signal/manual/{green,yellow,red,unlock}`).
2. Implement `TrafficSignalService` class with manual lock state machine.
3. Add Socket.io broadcaster for `system:state` events.
4. Test routes via curl, verify state machine works.
5. **Report:** Curl output showing manual lock active/expired, state transitions.

### Phase 4: Vue Integration (Do After Phase 3)
1. Wire Vue to Socket.io.
2. Create `ManualControlCard.vue` with three buttons.
3. Verify clicking buttons sends Socket.io events and UI updates.
4. **Report:** Video of manual button clicks, UI updating, timer counting down.

### Phase 5: YOLO Integration (Do After Phase 4)
1. Wire Python detection JSON to Node.js.
2. Implement YOLO 5-second rule + manual lock precedence.
3. Test: sustained detection triggers traffic stop, manual lock prevents YOLO.
4. **Report:** Video of pedestrian detected 5s → traffic stops → manual cannot override.

### Phase 6: Arduino Integration (Do After Phase 5)
1. Add Arduino serial communication.
2. Test manual/YOLO commands trigger LEDs.
3. **Report:** Video of traffic light responding to manual/YOLO triggers.

### Phase 7: Full Stack (All phases complete)
- Run complete checklist in Section 16.
- **Report:** Final video showing all components working together.

---

## 40. [NEW] Manual Control Page — Full Implementation

> **Intent:** A single page where the admin can (a) switch between `AUTO` (YOLO-driven) and `MANUAL` (admin-driven) modes, (b) press **GREEN / YELLOW / RED** and see the physical Arduino light respond immediately, and (c) run pre-baked **test scenarios** to exercise the full traffic cycle.
>
> **Golden rule:** The Vue button never talks to the Arduino. Path is always:
> `Vue Button ──Socket.io──► Node TrafficSignalService ──Serial──► Arduino ──► LEDs`

### 40.1 [NEW] Node.js — Unified State Machine (replaces Section 10.4)

The earlier spec scattered `setTimeout` calls and had a bug where cancelled cycles could still fire. Replace it with a **single-cycle runner** with a cancellable token and a `deadline`. This is the only place that writes to the serial port.

```ts
// server/src/services/trafficSignal.service.ts
import { arduinoSerial } from './arduinoSerial'
import { broadcast } from './socketIoBroadcaster'

export type Phase = 'GREEN' | 'YELLOW' | 'RED'
export type Mode  = 'AUTO' | 'MANUAL'
export type Source = 'MANUAL' | 'YOLO' | 'NONE'
export type ScenarioName = 'QUICK_TEST' | 'FULL_CYCLE' | 'PEDESTRIAN_TEST'

const GREEN_MS  = Number(process.env.TRAFFIC_GREEN_DURATION_MS  ?? 30000)
const YELLOW_MS = Number(process.env.TRAFFIC_YELLOW_DURATION_MS ?? 3000)
const RED_MS    = Number(process.env.TRAFFIC_RED_DURATION_MS    ?? 20000)
const YOLO_HOLD_MS = Number(process.env.YOLO_PEDESTRIAN_THRESHOLD_MS ?? 5000)

class TrafficSignalService {
  private mode: Mode = 'AUTO'
  private phase: Phase = 'GREEN'
  private controlledBy: Source = 'NONE'
  private deadline: number | null = null
  private timerHandle: NodeJS.Timeout | null = null

  private detectionStartedAt: number | null = null
  private yoloCycleActive = false

  /** Bumped on every cancelCycle() call. Guards every scheduled callback. */
  private cancelToken = 0

  // ---------------- public API ----------------

  getState() {
    const remaining = this.deadline
      ? Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000))
      : null

    return {
      mode: this.mode,
      traffic: this.phase,
      pedestrianState: this.phase === 'RED' ? 'WALK' : 'DONT_WALK',
      trafficTimerSec: this.phase === 'GREEN' ? null : remaining,
      pedestrianTimerSec: this.phase === 'RED' ? remaining : null,
      controlledBy: this.controlledBy,
      yoloLocked: this.phase !== 'GREEN' && this.controlledBy === 'YOLO',
      manualEnabled: this.mode === 'MANUAL',
    }
  }

  setMode(mode: Mode) {
    if (mode === this.mode) return { ok: true }
    this.mode = mode
    this.cancelCycle()
    // returning to AUTO always resets to green / no override
    this.applyPhase('GREEN', 'NONE', null)
    this.broadcast()
    return { ok: true }
  }

  /** Manual press: GREEN / YELLOW / RED */
  manualPress(phase: Phase) {
    if (this.mode !== 'MANUAL')
      return { ok: false, reason: 'not-in-manual-mode' }

    this.cancelCycle()
    this.controlledBy = 'MANUAL'

    switch (phase) {
      case 'GREEN':
        this.applyPhase('GREEN', 'MANUAL', null) // stays green until next press
        break
      case 'YELLOW':
        this.applyPhase('YELLOW', 'MANUAL', YELLOW_MS)
        this.schedule(YELLOW_MS, () => this.goRedThenGreen('MANUAL'))
        break
      case 'RED':
        this.applyPhase('RED', 'MANUAL', RED_MS)
        this.schedule(RED_MS, () => this.applyPhase('GREEN', 'MANUAL', null))
        break
    }
    return { ok: true }
  }

  /** Pre-baked test sequences so you can watch the light cycle without YOLO. */
  runScenario(name: ScenarioName) {
    if (this.mode !== 'MANUAL')
      return { ok: false, reason: 'not-in-manual-mode' }

    this.cancelCycle()
    this.controlledBy = 'MANUAL'

    const steps: { phase: Phase; ms: number }[] =
      name === 'QUICK_TEST'
        ? [
            { phase: 'GREEN',  ms: 2000 },
            { phase: 'YELLOW', ms: 2000 },
            { phase: 'RED',    ms: 3000 },
          ]
        : [
            { phase: 'GREEN',  ms: GREEN_MS  },
            { phase: 'YELLOW', ms: YELLOW_MS },
            { phase: 'RED',    ms: RED_MS    },
          ]

    this.playSequence(steps, 'MANUAL')
    return { ok: true }
  }

  /** Called by YOLO detection handler — only acts in AUTO mode. */
  handleYoloDetection(d: { detected: boolean; count: number; confidence: number }) {
    if (this.mode === 'AUTO' && !this.yoloCycleActive) {
      if (d.detected) {
        this.detectionStartedAt ??= Date.now()
        const held = Date.now() - this.detectionStartedAt
        if (held >= YOLO_HOLD_MS) {
          this.yoloCycleActive = true
          this.controlledBy = 'YOLO'
          this.playSequence(
            [
              { phase: 'YELLOW', ms: YELLOW_MS },
              { phase: 'RED',    ms: RED_MS    },
            ],
            'YOLO',
            /* finalPhase */ 'GREEN',
            /* onDone */ () => {
              this.yoloCycleActive = false
              this.detectionStartedAt = null
              this.controlledBy = 'NONE'
            },
          )
        }
      } else {
        this.detectionStartedAt = null
      }
    }
    this.broadcast()
  }

  // ---------------- internals ----------------

  /**
   * Runs phases back-to-back. Each transition is guarded by the cancel token,
   * so calling cancelCycle() (mode switch, new manual press, new scenario)
   * kills every pending transition from this sequence.
   */
  private playSequence(
    steps: { phase: Phase; ms: number }[],
    source: Source,
    finalPhase: Phase | null = 'GREEN',
    onDone?: () => void,
  ) {
    const token = this.cancelToken

    const runStep = (i: number) => {
      if (token !== this.cancelToken) return
      if (i >= steps.length) {
        if (finalPhase) this.applyPhase(finalPhase, source, null)
        onDone?.()
        return
      }
      const { phase, ms } = steps[i]
      this.applyPhase(phase, source, ms)
      setTimeout(() => runStep(i + 1), ms)
    }
    runStep(0)
  }

  private goRedThenGreen(source: Source) {
    this.playSequence(
      [{ phase: 'RED', ms: RED_MS }],
      source,
      'GREEN',
    )
  }

  private applyPhase(phase: Phase, source: Source, durationMs: number | null) {
    this.phase = phase
    this.controlledBy = source
    this.deadline = durationMs ? Date.now() + durationMs : null

    // ---- Arduino: traffic light ----
    const cmd =
      phase === 'GREEN'  ? 'NORMAL_TRAFFIC'  :
      phase === 'YELLOW' ? 'CAUTION_TRAFFIC' :
                           'STOP_TRAFFIC'
    arduinoSerial.send(cmd)

    // ---- Arduino: pedestrian signal ----
    arduinoSerial.send(phase === 'RED' ? 'PED_GREEN' : 'PED_RED')

    // ---- Arduino: countdown displays ----
    if (durationMs && phase !== 'GREEN') {
      const secs = Math.ceil(durationMs / 1000)
      arduinoSerial.send(`COUNTDOWN:${secs}`)
    }

    this.startTicker()
    this.broadcast()
  }

  private startTicker() {
    if (this.timerHandle) return
    this.timerHandle = setInterval(() => {
      if (this.deadline && Date.now() >= this.deadline) {
        clearInterval(this.timerHandle!)
        this.timerHandle = null
      }
      this.broadcast()
    }, 1000)
  }

  private cancelCycle() {
    this.cancelToken++
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
    this.deadline = null
  }

  private broadcast() {
    broadcast('system:state', this.getState())
  }
}

export const trafficSignalService = new TrafficSignalService()
```

**Why the `cancelToken` matters.** Without it, `manualPress('GREEN')` mid-red-cycle would still fire the old `goRedThenGreen` 2 s later — visibly jumping the light. With it, every scheduled callback checks whether it's still the current sequence before running.

### 40.2 [NEW] Socket.io Contract (client ⇄ server)

**Server wiring:**

```ts
// server/src/services/socketIoBroadcaster.ts (wiring)
io.on('connection', (socket) => {
  socket.join('dashboard')

  socket.on('ui:subscribe', () => socket.join('dashboard'))

  socket.on('ui:mode/set', ({ mode }, ack) => {
    const r = trafficSignalService.setMode(mode)
    ack?.({ ...r, state: trafficSignalService.getState() })
  })

  socket.on('ui:manual/press', ({ phase }, ack) => {
    const r = trafficSignalService.manualPress(phase)
    ack?.({ ...r, state: trafficSignalService.getState() })
  })

  socket.on('ui:manual/scenario', ({ name }, ack) => {
    const r = trafficSignalService.runScenario(name)
    ack?.({ ...r, state: trafficSignalService.getState() })
  })
})
```

**Event table:**

| Direction | Event | Payload | Ack |
|---|---|---|---|
| C → S | `ui:subscribe` | — | — |
| C → S | `ui:mode/set` | `{ mode: 'AUTO' \| 'MANUAL' }` | `{ ok, state }` |
| C → S | `ui:manual/press` | `{ phase: 'GREEN' \| 'YELLOW' \| 'RED' }` | `{ ok, reason?, state }` |
| C → S | `ui:manual/scenario` | `{ name: 'QUICK_TEST' \| 'FULL_CYCLE' \| 'PEDESTRIAN_TEST' }` | `{ ok, reason?, state }` |
| S → C | `system:state` | full `SystemState` snapshot | — |

### 40.3 [NEW] Arduino Command Handler (the "screen")

The Arduino stays dumb — it just reacts to newline-terminated serial commands. Add these handlers if not already present.

```cpp
// arduino/traffic_light.ino
const int CAR_RED    = 2;
const int CAR_YELLOW = 3;
const int CAR_GREEN  = 4;
const int PED_RED    = 5;
const int PED_GREEN  = 6;

String buf;

void setup() {
  Serial.begin(9600);
  pinMode(CAR_RED, OUTPUT);    pinMode(CAR_YELLOW, OUTPUT); pinMode(CAR_GREEN, OUTPUT);
  pinMode(PED_RED, OUTPUT);    pinMode(PED_GREEN, OUTPUT);
  allOff();
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { handle(buf); buf = ""; }
    else if (c != '\r') buf += c;
  }
}

void handle(String cmd) {
  cmd.trim();
  if      (cmd == "PING")             { Serial.println("PONG"); }
  else if (cmd == "NORMAL_TRAFFIC")   { carGreen();  Serial.println("OK GREEN");  }
  else if (cmd == "CAUTION_TRAFFIC")  { carYellow(); Serial.println("OK YELLOW"); }
  else if (cmd == "STOP_TRAFFIC")     { carRed();    Serial.println("OK RED");    }
  else if (cmd == "PED_GREEN")        { pedGreen(); }
  else if (cmd == "PED_RED")          { pedRed();   }
  else if (cmd.startsWith("COUNTDOWN:")) {
    int secs = cmd.substring(10).toInt();
    setCountdown(secs);          // drives 74HC595 + 7-seg multiplex
  }
  else Serial.println("ERR UNKNOWN");
}

void allOff() {
  digitalWrite(CAR_RED, LOW);   digitalWrite(CAR_YELLOW, LOW); digitalWrite(CAR_GREEN, LOW);
  digitalWrite(PED_RED, LOW);   digitalWrite(PED_GREEN, LOW);
}
void carGreen()  { allOff(); digitalWrite(CAR_GREEN, HIGH);  }
void carYellow() { allOff(); digitalWrite(CAR_YELLOW, HIGH); }
void carRed()    { allOff(); digitalWrite(CAR_RED, HIGH);    }
void pedGreen()  { digitalWrite(PED_RED, LOW);  digitalWrite(PED_GREEN, HIGH); }
void pedRed()    { digitalWrite(PED_GREEN, LOW); digitalWrite(PED_RED, HIGH);  }
```

### 40.4 [NEW] Vue Composable Additions

Extend `useLiveSystemState.ts` — the manual-page events only need these three emitters:

```ts
// frontend/src/composables/useLiveSystemState.ts (additions)

export type Mode = 'AUTO' | 'MANUAL'
export type Phase = 'GREEN' | 'YELLOW' | 'RED'
export type ScenarioName = 'QUICK_TEST' | 'FULL_CYCLE' | 'PEDESTRIAN_TEST'

// ...inside useLiveSystemState()...

const setMode = (mode: Mode) =>
  socket?.emit('ui:mode/set', { mode }, (ack: any) => {
    if (!ack?.ok) console.warn('setMode rejected:', ack?.reason)
  })

const pressManual = (phase: Phase) =>
  socket?.emit('ui:manual/press', { phase }, (ack: any) => {
    if (!ack?.ok) console.warn('manual rejected:', ack?.reason)
  })

const runScenario = (name: ScenarioName) =>
  socket?.emit('ui:manual/scenario', { name }, (ack: any) => {
    if (!ack?.ok) console.warn('scenario rejected:', ack?.reason)
  })

return { state, connected, setMode, pressManual, runScenario }
```

### 40.5 [NEW] Vue Component: `ManualControlCard.vue` (final)

Replaces the earlier Section 13.3 version. Adds mode switch, on-screen light preview, and scenario buttons.

```vue
<!-- frontend/src/components/ManualControlCard.vue -->
<template>
  <Card class="manual-card">
    <template #header>
      <div class="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900">
        <span class="font-bold text-lg">
          <i class="pi pi-hand-open-fill mr-2"></i>Manual Control
        </span>
        <div class="flex items-center gap-2">
          <i :class="mode === 'AUTO' ? 'pi pi-lock' : 'pi pi-unlock'"></i>
          <span class="text-sm">{{ mode === 'AUTO' ? 'YOLO Auto' : 'Manual' }}</span>
        </div>
      </div>
    </template>

    <div class="p-4 space-y-4">

      <!-- MODE SWITCH -->
      <div class="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span class="font-semibold">Mode</span>
        <div class="flex gap-2">
          <Button
            label="AUTO (YOLO)"
            icon="pi pi-eye"
            size="small"
            :severity="mode === 'AUTO' ? 'primary' : 'secondary'"
            @click="setMode('AUTO')"
          />
          <Button
            label="MANUAL"
            icon="pi pi-hand-open-fill"
            size="small"
            :severity="mode === 'MANUAL' ? 'primary' : 'secondary'"
            @click="setMode('MANUAL')"
          />
        </div>
      </div>

      <!-- TRAFFIC LIGHT PREVIEW (mirrors hardware) -->
      <div class="flex justify-center gap-3 py-2">
        <span class="dot green"  :class="{ on: phase === 'GREEN'  }"></span>
        <span class="dot yellow" :class="{ on: phase === 'YELLOW' }"></span>
        <span class="dot red"    :class="{ on: phase === 'RED'    }"></span>
      </div>

      <!-- MANUAL BUTTONS -->
      <Button
        label="GREEN"  icon="pi pi-play"
        :severity="phase === 'GREEN'  ? 'success' : 'secondary'"
        :disabled="mode !== 'MANUAL'"
        class="w-full" size="large"
        @click="press('GREEN')"
      />
      <Button
        label="YELLOW" icon="pi pi-circle-fill"
        :severity="phase === 'YELLOW' ? 'warning' : 'secondary'"
        :disabled="mode !== 'MANUAL'"
        class="w-full" size="large"
        @click="press('YELLOW')"
      />
      <Button
        label="RED"    icon="pi pi-stop-circle"
        :severity="phase === 'RED'    ? 'danger'  : 'secondary'"
        :disabled="mode !== 'MANUAL'"
        class="w-full" size="large"
        @click="press('RED')"
      />

      <!-- SCENARIOS -->
      <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p class="text-sm font-semibold mb-2 text-gray-600">Test Scenarios</p>
        <div class="grid grid-cols-2 gap-2">
          <Button label="Quick Test"      icon="pi pi-bolt"    size="small" severity="help"
                  :disabled="mode !== 'MANUAL'" @click="scenario('QUICK_TEST')" />
          <Button label="Full Cycle"      icon="pi pi-refresh" size="small" severity="help"
                  :disabled="mode !== 'MANUAL'" @click="scenario('FULL_CYCLE')" />
          <Button label="Pedestrian Test" icon="pi pi-user"    size="small" severity="help"
                  class="col-span-2"
                  :disabled="mode !== 'MANUAL'"
                  @click="scenario('PEDESTRIAN_TEST')" />
        </div>
      </div>

      <!-- STATUS LINE -->
      <p class="text-center text-sm text-gray-500">
        <template v-if="mode === 'AUTO'">
          YOLO controls the light. Switch to Manual to take over.
        </template>
        <template v-else-if="controlledBy === 'YOLO'">
          YOLO cycle running…
        </template>
        <template v-else>
          Manual — press a light or run a scenario.
        </template>
      </p>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLiveSystemState } from '../composables/useLiveSystemState'

const { state, setMode, pressManual, runScenario } = useLiveSystemState()

const mode         = computed(() => state.value?.mode         ?? 'AUTO')
const phase        = computed(() => state.value?.traffic      ?? 'GREEN')
const controlledBy = computed(() => state.value?.controlledBy ?? 'NONE')

function press(p: 'GREEN' | 'YELLOW' | 'RED') { pressManual(p) }
function scenario(n: 'QUICK_TEST' | 'FULL_CYCLE' | 'PEDESTRIAN_TEST') { runScenario(n) }
</script>

<style scoped>
.manual-card { border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

.dot {
  width: 56px; height: 56px; border-radius: 9999px;
  background: #1f2937; opacity: 0.25;
  transition: all 150ms ease-in-out;
}
.dot.green.on  { background: #10B981; opacity: 1; box-shadow: 0 0 18px #10B981; }
.dot.yellow.on { background: #FBBF24; opacity: 1; box-shadow: 0 0 18px #FBBF24; }
.dot.red.on    { background: #EF4444; opacity: 1; box-shadow: 0 0 18px #EF4444; }
</style>
```

### 40.6 [NEW] Manual Page — Test Checklist

- [ ] Node boots, Arduino sends `PONG` on `PING`.
- [ ] Dashboard `mode` shows `AUTO`, all three buttons disabled.
- [ ] Click **MANUAL** → buttons unlock, mode indicator flips.
- [ ] Press **GREEN** → on-screen green dot lights, Arduino green LED lights.
- [ ] Press **YELLOW** → yellow for `TRAFFIC_YELLOW_DURATION_MS`, then auto-→ red.
- [ ] Press **RED** → red for `TRAFFIC_RED_DURATION_MS`, then auto-→ green.
- [ ] Press **Quick Test** → 2 s green → 2 s yellow → 3 s red → green.
- [ ] Press **Full Cycle** → runs with configured durations.
- [ ] Switch to **AUTO** → press buttons → ack returns `not-in-manual-mode`.
- [ ] In **AUTO**, stand in frame for 5 s → same yellow→red→green cycle fires.
- [ ] While YOLO cycle is running, switch to **MANUAL** → cycle cancels, buttons unlock.

---

## 41. [NEW] Dashboard Layout Skill

> A **layout skill** = a documented, reusable pattern for composing dashboard pages. Any new page must follow this skill. This guarantees consistent spacing, responsive behavior, and dark-mode support without re-inventing grids.

### 41.1 Layout Principles

1. **Max content width: `max-w-7xl` (1280 px), centered.** Prevents eye strain on ultrawide monitors.
2. **Page container owns only horizontal padding and background.** Never add vertical margins here — they belong to the grid.
3. **Everything between sections is a `gap`, not a margin.** Use `flex` / `grid` `gap` so components stay margin-agnostic.
4. **Cards are the atomic unit.** Every panel (feed, manual, YOLO, timers) is a `Card`. Consistent header/body/footer.
5. **Mobile-first, single-column.** Breakpoints only ever *add* columns, never remove.
6. **Dark mode is first-class.** Every surface uses Tailwind `dark:` variants. No hard-coded whites.

### 41.2 Responsive Grid Rules

| Breakpoint | Tailwind | Grid | Notes |
|---|---|---|---|
| Mobile | default | `grid-cols-1` | Full-width cards stacked. Live feed first. |
| Tablet | `md:` (≥768) | `grid-cols-2` | Manual + YOLO side-by-side. Live feed stays full width. |
| Desktop | `lg:` (≥1024) | `grid-cols-3` | Live feed spans 2 cols; Manual + YOLO share a 1-col sidebar. |

**Column span cheat-sheet**

```html
<!-- Live feed: 2/3 on desktop, full width below -->
<div class="lg:col-span-2">…</div>

<!-- Sidebar (Manual + YOLO stacked): 1/3 on desktop -->
<div class="lg:col-span-1 flex flex-col gap-6">…</div>
```

### 41.3 The Layout Shell — `DashboardLayout.vue`

Create this **once** and every page slots into it. This is the reusable skill.

```vue
<!-- frontend/src/layouts/DashboardLayout.vue -->
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

      <!-- SLOT: page header (title + status chips) -->
      <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-semibold leading-tight">
            <i :class="[icon, 'mr-2']"></i>{{ title }}
          </h1>
          <p v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <!-- SLOT: header actions (connection dots, theme toggle) -->
          <slot name="actions" />
        </div>
      </header>

      <!-- SLOT: main content -->
      <main class="flex flex-col gap-6">
        <slot />
      </main>

      <!-- SLOT: footer -->
      <footer class="text-xs text-gray-400 dark:text-gray-500 text-center pt-4">
        <slot name="footer">
          Localhost prototype — not for production use
        </slot>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  icon?: string
}>()
</script>
```

### 41.4 The Dashboard Page — `App.vue` (uses layout + skill)

```vue
<!-- frontend/src/App.vue -->
<template>
  <DashboardLayout
    title="Pedestrian Crosswalk Control"
    subtitle="Localhost prototype — real-time YOLO + manual override"
    icon="pi pi-server"
  >
    <template #actions>
      <ConnectionDot :online="state?.yoloOnline" label="YOLO" />
      <ConnectionDot :online="state?.arduinoOnline" label="Arduino" />
      <ConnectionDot :online="connected" label="Server" />
    </template>

    <!-- ROW 1: Live feed (full width on all sizes) -->
    <LiveFeedCard />

    <!-- ROW 2: 3-column desktop grid — feed slot + sidebar -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Sidebar: manual + YOLO stacked -->
      <div class="lg:col-span-1 flex flex-col gap-6 lg:order-2">
        <ManualControlCard />
        <YoloStatusCard />
      </div>

      <!-- Main: timers + history -->
      <div class="lg:col-span-2 flex flex-col gap-6 lg:order-1">
        <TimerDisplayCard />
        <DetectionHistoryCard />   <!-- optional, Section 42 -->
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import DashboardLayout from './layouts/DashboardLayout.vue'
import LiveFeedCard from './components/LiveFeedCard.vue'
import ManualControlCard from './components/ManualControlCard.vue'
import YoloStatusCard from './components/YoloStatusCard.vue'
import TimerDisplayCard from './components/TimerDisplayCard.vue'
import DetectionHistoryCard from './components/DetectionHistoryCard.vue'
import ConnectionDot from './components/ConnectionDot.vue'
import { useLiveSystemState } from './composables/useLiveSystemState'

const { state, connected } = useLiveSystemState()
</script>
```

### 41.5 Layout Primitives (put in `src/index.css` or Tailwind `@layer components`)

Reusable Tailwind snippets. Use these instead of ad-hoc utility soup. This is the *skill* part — codify the pattern once.

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  /* Standard card shell — every dashboard panel uses this */
  .card {
    @apply rounded-lg border border-gray-200 dark:border-gray-700
           bg-white dark:bg-gray-800
           shadow-sm overflow-hidden;
  }

  /* Card header — colored strip at top of every card */
  .card-header {
    @apply flex items-center justify-between px-4 py-3
           border-b border-gray-200 dark:border-gray-700
           font-semibold text-base;
  }

  .card-body   { @apply p-4 sm:p-6; }
  .card-footer { @apply px-4 py-3 border-t border-gray-200 dark:border-gray-700
                        bg-gray-50 dark:bg-gray-900
                        text-xs text-gray-500 dark:text-gray-400; }

  /* Two-col form row used inside cards */
  .stat-row {
    @apply flex items-center justify-between py-2
           border-b border-gray-100 dark:border-gray-700 last:border-b-0;
  }
  .stat-label { @apply text-sm text-gray-500 dark:text-gray-400 font-medium; }
  .stat-value { @apply text-sm font-semibold; }

  /* Connection status dot — used in layout header */
  .conn-dot        { @apply inline-block w-2.5 h-2.5 rounded-full mr-1; }
  .conn-dot.online { @apply bg-emerald-500 shadow-[0_0_6px_#10B981]; }
  .conn-dot.offline{ @apply bg-red-500; }

  /* Timer display — 7-seg look, reused in TimerDisplayCard */
  .timer-display {
    font-family: 'DSEG7 Classic', 'Courier New', monospace;
    @apply text-[2.5rem] sm:text-[3rem]
           text-[#00ff00] bg-black
           px-4 py-2 rounded-md
           tracking-widest text-center inline-block;
    min-width: 4.5ch;
  }
}
```

### 41.6 `ConnectionDot.vue` — small layout helper

```vue
<!-- frontend/src/components/ConnectionDot.vue -->
<template>
  <span
    class="inline-flex items-center gap-1 px-2 py-1 rounded-md
           bg-gray-100 dark:bg-gray-800 text-xs font-medium"
    :title="`${label}: ${online ? 'online' : 'offline'}`"
  >
    <span class="conn-dot" :class="online ? 'online' : 'offline'"></span>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ online: boolean; label: string }>()
</script>
```

### 41.7 Section vs Card — When to Use Which

| Situation | Use |
|---|---|
| Distinct dashboard panel (feed, manual, timers) | `Card` |
| Structural grouping of multiple cards | `<div class="flex flex-col gap-6">` |
| Page-level horizontal band | Grid row + col-span |
| Small inline stat (Pedestrian Count, Confidence) | `.stat-row` inside a Card |
| One-off colored header strip | `.card-header` + bg utility |

### 41.8 Layout Skill Checklist

Before merging any new page, confirm:

- [ ] Page uses `<DashboardLayout>` — no custom outer `<div class="min-h-screen">`.
- [ ] All gaps are `gap-6` (24 px). No `mt-*` between sibling cards.
- [ ] Grid collapses to 1 column on mobile — test at 375 px width.
- [ ] Every card uses `.card` `.card-header` `.card-body` — no inline white bg.
- [ ] Dark mode verified: toggle OS theme, no white flashes.
- [ ] Header has exactly one `h1`; components use `h2` / `h3` below.
- [ ] Header `actions` slot holds connection dots and theme toggle only.
- [ ] Footer text is 12 px (`text-xs`) and muted.

### 41.9 Adding a New Page (template)

Any future page (e.g., `/settings`, `/logs`) follows this template:

```vue
<!-- frontend/src/pages/SettingsPage.vue -->
<template>
  <DashboardLayout title="Settings" icon="pi pi-cog">
    <template #actions>
      <ConnectionDot :online="connected" label="Server" />
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card class="card">
        <template #header>
          <div class="card-header">Timing</div>
        </template>
        <div class="card-body">
          <!-- settings form -->
        </div>
      </Card>

      <Card class="card">
        <template #header>
          <div class="card-header">Hardware</div>
        </template>
        <div class="card-body">
          <!-- hardware config -->
        </div>
      </Card>
    </div>
  </DashboardLayout>
</template>
```

---

**END OF SECTION 41**
---

**END OF UPDATED MASTERPLAN**