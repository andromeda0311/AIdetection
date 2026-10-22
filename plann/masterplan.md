# AI-Driven Pedestrian Crosswalk System — Enhanced Localhost Implementation Spec

> **Audience note for the coding agent:**
> This file is a step-by-step build spec with **NEW SECTIONS** on Manual Mode, YOLO Activation Switch, UI Framework, and Taste/Design Guidelines.
> Sections marked **[NEW]** are additions to the original spec.
> Follow steps **in order**. Do not skip ahead. Where marked **FIXED**, do not change. Where **CONFIGURABLE**, read from env.

---

## 0. Project Goal (one paragraph)

Build a **local, real-time** premium pipeline where a webcam feeds a Python YOLO service, which detects pedestrians using a custom-trained model (`best.pt`), streams the annotated video and detection events to an existing Node.js server. The system operates in **two distinct modes** with separate dedicated pages:

1. **Manual Control Page** — Admin manually triggers traffic state (GREEN → YELLOW → RED) with fully configurable durations per state. No YOLO inference affects the output. Features light duration adjustment inputs and Arduino status monitoring.
2. **YOLO Activation Page** — A pedestrian standing in frame for 5 seconds automatically triggers the same state machine with configured durations. Higher priority than manual mode but yields when manual lock is active. Features real-time detection metrics and auto-cycle visualization.

The Node.js server relays state to a Vite + Vue 3 dashboard with PrimeVue 4.x components, sends high-level commands over USB serial to an Arduino Uno that physically controls a traffic light + pedestrian walk signals + countdown displays. The frontend is redesigned as a **premium, responsive website** with separate pages for each mode, configuration panels, and audit logging.

This is a **localhost prototype only**. No cloud, no Docker, no auth, no WebRTC, until every milestone below passes.

---

## 0.1 [NEW] Operating Modes & Pages

The application features two dedicated pages, each with its own layout and controls:

### Page 1: Manual Control (`/manual`)
- **Fully Configurable** — Admin sets green/yellow/red durations via input fields before starting a cycle.
- **Duration Inputs** — Numeric inputs for `Green Duration`, `Yellow Duration`, `Red Duration` (all in seconds, configurable via `.env`).
- **Lock/Unlock UI** — Visual indicator (lock icon) showing whether manual override is active.
- **Start Cycle** — Clicking any state button initiates the traffic cycle with the configured durations.
- **YOLO Fallback** — If manual lock expires (timer fires) or admin explicitly unlocks, the user is redirected to the YOLO Activation page or YOLO can trigger on the next detection.
- **Arduino Status** — Real-time connection status and last command sent to Arduino displayed in sidebar.

### Page 2: YOLO Activation (`/auto`)
- **Pedestrian Detection 5 s** → Trigger traffic stop (RED + pedestrian walk) automatically.
- **Duration** — Respect `RED_DURATION_MS` (20 s default), then auto-return to GREEN.
- **Higher Priority Than Manual** — If a manual override is active and YOLO detects a pedestrian for 5 s, YOLO's trigger overrides and starts a new cycle on the YOLO Activation page.
- **Interruptible** — An admin can interrupt with manual mode at any time, switching to the Manual Control page.
- **Detection Metrics** — Real-time display of pedestrian count, confidence percentage, and detection duration (0–5 s).
- **Auto-Cycle Visualization** — Animated traffic light showing current state progression.

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

## 1.1 [NEW] UI Framework & Design System — Premium Multi-Page Layout

### Framework: PrimeVue 4.x + Tailwind CSS 3.3+
- **Component Library** — PrimeVue (Vue 3 compatible) for buttons, modals, dropdowns, badges, panels, and overlays.
- **Styling** — Tailwind CSS 3.3+ for utility-first layouts, responsive design, dark mode with CSS variables.
- **Icon Set** — PrimeIcons (built-in with PrimeVue) for traffic lights, lock/unlock, play/stop, timer, pedestrian.
- **Dark Mode** — Full support: automatic via `@media (prefers-color-scheme: dark)` + PrimeVue theme toggle in header.
- **Responsive** — Mobile-first design that adapts from single-column (mobile) to three-column grid (desktop).
  - Mobile (< 640px): Single column, full-width cards
  - Tablet (640px – 1024px): Two-column grid (Manual | YOLO)
  - Desktop (> 1024px): Three-column grid (Live Feed | Manual | YOLO)

### Why PrimeVue?
- Rich, production-ready UI components (Badge, Button, Card, Dropdown, Panel, ProgressBar, Chart).
- Built-in accessibility (ARIA labels, keyboard navigation, focus-visible states).
- Theming system (Lara theme customization via CSS variables for premium feel).
- Consistent styling across all pages and components.
- No lock-in — components can be replaced if design system evolves.

### Premium Design Tokens (Tailwind + CSS Variables)
```css
:root {
  --bg-light: #FFFFFF;
  --bg-dark: #111827;
  --surface-light: #F8FAFC;
  --surface-dark: #1E293B;
  --primary: #0F172A;
  --accent-emerald: #00D4AA;
  --accent-pink: #F472B6;
  --accent-orange: #FB923C;
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --border-light: #E5E7EB;
  --border-dark: #374151;
}
```

### Installation (frontend)
```bash
cd frontend
npm install primevue primeicons tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Setup (main.ts) — PrimeVue + Custom Theme
```typescript
import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import 'primevue/resources/primevue.css'
import 'primeicons/primeicons.css'
import './index.css'  // Tailwind + custom variables

import App from './App.vue'

const app = createApp(app)
app.use(PrimeVue)

// Custom PrimeVue theme configuration (laralight modified)
app.config.globalProperties.$primevue = {
  theme: {
    preset: {
      components: {
        button: {
          base: {
            borderRadius: '0.5rem',
            transition: 'all 200ms ease-out'
          }
        }
      }
    }
  }
}

app.mount('#app')
```

---

## 1.2 [NEW] Taste / Design Guidelines for UI Components — Premium Multi-Page

### Button Design (PrimeVue Button) — Three Variants

**Manual Control Buttons** (Manual Control page) — Three large, centered buttons.
- **Primary (GREEN)** — Background: `#10B981`, text: white, hover: `#059669`
- **Warning (YELLOW)** — Background: `#FBBF24`, text: `#92400E`, hover: `#D97706`
- **Danger (RED)** — Background: `#EF4444`, text: `#991B1B`, hover: `#DC2626`
- **Active state** — Scale `1.02x` + shadow glow in state color
- **Inactive state** — Opacity 0.7, cursor default
- **Disabled state** (YOLO lock active) — Opacity 0.5, cursor `not-allowed`, no hover effect
- **Size** — `lg` (PrimeVue), padding `1rem 1.5rem`, icon left + text right
- **Font** — 16px bold, uppercase letters (`GREEN`, `YELLOW`, `RED`), tracking wider
- **Transition** — `all 200ms ease-out` on hover/active
- **Rounded corners** — `border-radius: 0.75rem`
- **Example markup:**
  ```vue
  <Button 
    label="GREEN" 
    icon="pi pi-play" 
    severity="success"
    :disabled="yoloLockActive || manualLockActive"
    @click="startManualGreen"
    class="w-full mb-4"
    size="large"
  />

  <!-- Adjustable duration input shown alongside -->
  <div class="mt-2 flex items-center justify-between">
    <InputNumber 
      min={1} 
      max={300} 
      step={1} 
      :model-value="greenDurationSec" 
      @update:model-value="greenDurationSec = $event" 
      class="w-24"/>
    <span class="text-sm text-gray-500">seconds</span>
  </div>
  ```

### Page-Specific Button Groups

**Manual Page Buttons:**
- `GREEN` — Starts GREEN state with configured duration
- `YELLOW` — Starts YELLOW state (3s by default) → RED cycle
- `RED` — Starts RED state with configured duration
- `UNLOCK` — Releases manual lock, returns to ready state

**YOLO Activation Page Buttons:**
- `DETECT` — Manual trigger to test detection (for admin testing)
- `RESET` — Reset detection timer if pedestrian left frame
- `CYCLE VIS` — Show/hide auto-cycle animation

### Status Badges & Indicators — Enhanced

**Traffic State Badge** — Large, centered component on both pages.
- Background color matches traffic light state
- Text white, bold, 24px font
- Rounded pill shape (`border-radius: 9999px`)
- Animated pulse on state transition (2s cycle)
- **Example (Manual page):**
  ```vue
  <Badge 
    class="p-6 text-3xl font-bold"
    :class="`bg-${traffic === 'GREEN' ? 'emerald-600' : traffic === 'YELLOW' ? 'amber-600' : 'red-600'}-100 text-${traffic === 'GREEN' ? 'emerald-800' : traffic === 'YELLOW' ? 'amber-800' : 'red-800'}`"
  >
    {traffic}
  </Badge>
  ```

**YOLO Detection Badge** (YOLO Activation page only).
- Shows detection duration with progress bar
- **Example:**
  ```vue
  <div class="flex items-center gap-2">
    <ProgressBar 
      :value="detectionDurationSec * 20" 
      :show-value="false" 
      class="w-24 h-4"
    />
    <span class="text-sm">{{ detectionDurationSec.toFixed(1) }}s/5s</span>
  </div>
  ```

**Arduino Online Badge** (sidebar on both pages).
- Green dot: `pi pi-check-circle text-emerald-500`
- Red dot: `pi pi-times-circle text-red-500`
- Tooltip: `"Arduino connected"` / `"Arduino disconnected"`

### Timer Display (7-Segment Style) — Enhanced

- **Font** — DSEG7 Classic or `Courier New`, monospace fallback
- **Color** — LED green (`#00FF00`) on black background during RED/YELLOW, gray during GREEN
- **Size** — Responsive: `2.5rem` (mobile) / `4rem` (desktop)
- **Padding** — `0.5rem 1rem`, `border-radius: 0.5rem`
- **Responsive typography** — `text-sm` (mobile) / `text-lg` (desktop)
- **Values displayed:**
  - During GREEN: `--` (blank/—)
  - During YELLOW: Counts down `3` → `0` (seconds)
  - During RED: Counts down `20` → `0` (seconds)
  - After cycle: `--` (blank)
  - Configurable durations shown on Manual page inputs
- **Update frequency** — Every 1 second (no partial decimals)
- **Example CSS:**
  ```css
  .timer-display {
    font-family: 'DSEG7 Classic', 'Courier New', monospace;
    font-size: clamp(1.5rem, 4vw, 3rem);
    color: #00ff00;
    background: #000;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    display: inline-block;
    min-width: 4ch;
    text-align: center;
    letter-spacing: 0.05em;
    text-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
  }

  @media (min-width: 1024px) {
    .timer-display { font-size: 3rem; }
  }
  ```

### Card Layouts (PrimeVue Card) — Page-Specific

**Manual Control Card** — Manual Control page header.
- Header: `Manual Control` icon + lock badge + duration config summary
- Content: Three large buttons + duration input fields stacked
- Footer: Cycle status + Arduino status indicator
- Shadow: `0 4px 20px rgba(0,0,0,0.15)` (enhanced)
- Border: 1px solid `#CBD5E1` (light slate)
- Background: `bg-white dark:bg-gray-800`

**YOLO Status Card** — YOLO Activation page content area.
- Header: `Auto Detection` + YOLO lock badge + detection metrics
- Content: Pedestrian count, confidence percentage, detection duration, sparkline
- Footer: Cycle status + last trigger timestamp
- Shadow: `0 4px 20px rgba(0,0,0,0.15)`
- Border: 1px solid `#CBD5E1`

**Live Feed Card** — Top of both pages.
- Content: `<img src="http://localhost:8000/video">` in responsive container
- Aspect ratio: `aspect-[16/9]` or `padding-bottom: 56.25%`
- Border: 2px solid `#94A3B8` (slate-400)
- Background: `bg-black`
- Loading skeleton: `animate-pulse` during initial load

**Audit Logs Card** — New page (see Section 2.4).
- Header: `Audit Logs` + refresh button
- Content: Table with Date, Event, Details, Arduino State columns
- Footer: Last update timestamp, export button
- Shadow: `0 4px 20px rgba(0,0,0,0.15)`
- Border: 1px solid `#CBD5E1`
- Lightweight: only loads last 50 entries, paginated optional

### Typography — Premium Scale

- **Heading** (h1) — `2xl` (1.875rem), weight `600`, tracking `0.15em`, color `--text-primary`
- **Heading** (h2) — `lg` (1.25rem), weight `500`, color `--text-primary`
- **Body** (p, span) — `base` (1rem), weight `400`, line-height `1.6`, color `--text-secondary`
- **Labels** (button, badge) — `sm` (0.875rem), weight `500`, uppercase, letter-spacing `0.05em`, color `--text-primary`
- **Timer text** — `clamp(1.5rem, 4vw, 3rem)` (responsive), weight `700`, color `#00FF00` on black
- **Small text** — `sm` (0.875rem), weight `400`, color `--text-muted`
- **Monospace** (timer display) — `ui-monospace, Menlo, Monaco, "Courier New", monospace`

### Color Palette — Premium Extended

- **Success (Green)** — `#10B981` (100) / `#059669` (600) / `#0F172A` (900)
- **Warning (Yellow)** — `#FBBF24` (100) / `#D97706` (600) / `#1E293B` (900)
- **Danger (Red)** — `#EF4444` (100) / `#DC2626` (600) / `#1E293B` (900)
- **Primary (Navy)** — `#0F172A` (background, headers)
- **Secondary (Slate)** — `#64748B` (secondary text, borders)
- **Emerald Accent** — `#00D4AA` (highlights, success states)
- **Pink Accent** — `#F472B6` (warnings, secondary)
- **Orange Accent** — `#FB923C` (actions, attention)
- **Background** — `#FFFFFF` (light) / `#111827` (dark)
- **Surface** — `#F8FAFC` (light) / `#1E293B` (dark)
- **Border** — `#E5E7EB` (light) / `#374151` (dark)
- **Arduino Online** — `#059669` (emerald-600)
- **Arduino Offline** — `#DC2626` (red-600)

### Spacing & Layout — Responsive Grid

- **Mobile** (< 640px): 
  - Single-column layout
  - Stack: Live Feed → Manual → YOLO → Timers → Audit Logs
  - Button: 44px min height (touch-friendly)
  - Padding: 1rem

- **Tablet** (640px – 1024px): 
  - Two-column grid (Manual | YOLO on Activation page)
  - Live Feed full-width above grid
  - Button: 48px height

- **Desktop** (> 1024px): 
  - Three-column grid (Live Feed | Manual | YOLO)
  - Audit Logs sidebar or separate tab
  - Button: 52px height
  - Sidebar: 320px fixed width (optional)

- **Padding** — `1rem` (mobile) / `1.5rem` (desktop) between major elements

### Dark Mode — Full Support

- **Toggle button** — Header button or PrimeVue Sidebar theme switcher
- **CSS variables** — All colors use CSS variables that flip in dark mode
- **Custom CSS:**
  ```css
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-light: #111827;
      --bg-dark: #0F172A;
      --surface-light: #1E293B;
      --text-primary: #F8FAFC;
      --text-secondary: #94A3B8;
      --border-light: #374151;
      --border-dark: #1E293B;
    }
    .timer-display {
      color: #00FF00;
      background: #000;
    }
    .card { background: var(--surface-dark) !important; }
  }
  ```

### Responsive Breakpoints

- **Mobile** (< 640px): `sm:` — Single column, touch-optimized
- **Tablet** (640px – 1024px): `md:` — Two-column grid
- **Desktop** (> 1024px): `lg:` — Three-column grid with sidebar option

### Loading & Error States — Premium Patterns

**Skeleton Loading** (all cards):
```vue
<Skeleton className="h-64 w-full rounded-lg animate-pulse" />
```

**Error State** (with retry):
```vue
<div className="p-8 text-center">
  <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
  <h3 className="text-lg font-medium">Connection issue</h3>
  <Button @retry="reconnect" className="mx-2">Retry</Button>
  <Button @copy="copyLogs" className="mx-2 text-sm text-blue-600">Export logs</Button>
</div>
```

**Empty State** (no detections yet):
```vue
<div className="p-12 text-center text-gray-500">
  <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
  <p>No pedestrians detected yet</p>
  <p className="mt-2">Ensure camera is connected and YOLO service is running</p>
</div>
```

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

## 2.1 [NEW] Manual Override State Machine with Configurable Durations (Node.js)

The manual state machine now supports admin-configured durations via the Manual Control page inputs. Durations are read from `.env` defaults but can be overridden per-cycle.

```
┌─────────────────────────────┐
│   MANUAL CONFIGURATION        │
│  Set durations, then start    │
│  cycle with chosen values     │
└───────┬───────────────────────┘
        │ Set durations + Start
        ▼
┌─────────────────────┐
│   NORMAL            │  Default state. YOLO can trigger.
│  (GREEN)            │  Timers use configured durations.
└───────┬─────────────┘
        │ Manual: Set durations, click GREEN
        ▼
┌─────────────────────┐
│  MANUAL_ACTIVE      │  Manual lock ACTIVE.
│  (GREEN)            │  Timer running (configurable duration).
│  Custom duration    │  YOLO cannot trigger.
│  set by admin       │
└───────┬─────────────┘
        │ Manual lock timer expires
        ▼
┌─────────────────────┐
│   NORMAL            │  Lock released. YOLO can trigger again.
│  (GREEN)            │
└─────────────────────┘

        │ OR: Admin clicks YELLOW → predefined sequence
        ▼
┌─────────────────────────────────────┐
│  MANUAL_ACTIVE (YELLOW) → RED       │
│  Sequence: YELLOW 3s → RED 20s →    │
│  GREEN (lock releases after cycle)  │
│  Durations: Yellow from config,     │
│  Red from config                    │
└─────────────────────────────────────┘

        │ OR: YOLO detection fires DURING manual lock
        ▼
┌────────────────────────────┐
│   MANUAL_ACTIVE (locked)   │  YOLO still publishing JSON.
│  (GREEN/YELLOW/RED)        │  
│  Custom duration active    │  
└───────┬────────────────────┘
        │ Pedestrian detected ≥5s
        │ AND manual lock expires
        ▼
┌────────────────────────────┐
│   YOLO_TRIGGERED           │  YOLO takes control, new cycle starts.
│  (RED) for configured RED  │  Manual lock released.
│  Duration: configurable    │  
└────────────────────────────┘
        │ 20s (or configured) elapsed
        ▼
┌─────────────────────┐
│   NORMAL            │
│  (GREEN)            │
└─────────────────────┘
```

### 2.1.1 Duration Configuration Workflow

1. **Admin navigates to Manual Control page**
2. **Inputs appear** for Green Duration, Yellow Duration, Red Duration
3. **Default values** read from `.env`:
   - `TRAFFIC_GREEN_DURATION_MS=30000` (30s)
   - `TRAFFIC_YELLOW_DURATION_MS=3000` (3s)
   - `TRAFFIC_RED_DURATION_MS=20000` (20s)
4. **Admin adjusts** any duration via numeric input (seconds)
5. **Start cycle** — Click GREEN/YELLOW/RED button
6. **Service uses** the configured duration for that cycle
7. **Duration resets** to `.env` defaults after cycle completes

### 2.1.2 System State Enhancements

Updated `SystemState` interface includes configurable durations:

```typescript
interface SystemState {
  // Traffic & Pedestrian State
  traffic: 'GREEN' | 'YELLOW' | 'RED';
  pedestrianState: 'WALK' | 'DONT_WALK';
  
  // Timers (seconds remaining)
  trafficTimerSec: number | null;
  pedestrianTimerSec: number | null;
  
  // Configurable durations (from .env, adjustable per-cycle)
  greenDurationSec: number;       // From TRAFFIC_GREEN_DURATION_MS / 1000
  yellowDurationSec: number;      // From TRAFFIC_YELLOW_DURATION_MS / 1000
  redDurationSec: number;         // From TRAFFIC_RED_DURATION_MS / 1000
  
  // YOLO Detection
  yoloOnline: boolean;
  pedestrianDetected: boolean;
  pedestrianCount: number;
  pedestrianConfidence: number;
  detectionDurationSec: number;   // How long pedestrian has been visible (0–5)
  
  // Manual Mode State
  manualLock: boolean;
  manualLockExpiresSec: number | null;
  controlledBy: 'MANUAL' | 'YOLO' | 'NONE';
  currentCycleDurationSec: number; // Which duration is currently counting
  
  // Hardware Health
  arduinoOnline: boolean;
  cameraOnline: boolean;
  
  // Audit
  lastAuditEntry: AuditEntry | null;
}
```

### 2.1.3 TrafficSignalService — Enhanced with Configurable Durations

Key changes:
- `setManualLock()` now accepts optional duration parameters
- If no duration provided, uses `.env` defaults
- `transitionTraffic()` uses `currentCycleDurationSec` instead of hardcoded constants
- `countdownTimer()` respects configurable durations
- Broadcasts `currentCycleDurationSec` to Vue for UI display

---

## 3. Repository Structure (UPDATED — Multi-Page + Premium UI)

```
project/
├── frontend/                 # Vite + Vue 3 + PrimeVue 4.x
│   ├── src/
│   │   ├── components/
│   │   │   ├── ManualControlCard.vue          # Manual button panel + duration config
│   │   │   ├── YoloStatusCard.vue             # YOLO detection panel + metrics
│   │   │   ├── TimerDisplayCard.vue           # 7-segment timer display
│   │   │   ├── LiveFeedCard.vue               # MJPEG stream container
│   │   │   ├── SystemStatusBadge.vue          # State indicator (traffic/Arduino)
│   │   │   ├── ManualDurationConfig.vue       # Duration input fields (manual page)
│   │   │   ├── AuditLogsCard.vue              # Audit log table (audit page)
│   │   │   └── TrafficLightAnimated.vue       # Animated traffic light visualization
│   │   ├── pages/                             # NEW: Dedicated pages per mode
│   │   │   ├── ManualPage.vue                 # Manual control page
│   │   │   ├── YoloActivationPage.vue         # YOLO auto-detection page
│   │   │   └── AuditLogsPage.vue              # Audit logs page
│   │   ├── composables/
│   │   │   ├── useLiveSystemState.ts          # Socket.io connection + state
│   │   │   ├── useManualControl.ts            # Manual lock/unlock logic
│   │   │   └── useAuditLogs.ts                # Audit logs fetch/comet
│   │   ├── layouts/
│   │   │   ├── Header.vue                     # Premium header with mode toggle
│   │   │   ├── Sidebar.vue                    # Navigation sidebar
│   │   │   └── Footer.vue                     # Footer with links
│   │   ├── types.ts
│   │   ├── App.vue                            # Main router/layout container
│   │   └── main.ts                            # PrimeVue + Tailwind setup
│   ├── tailwind.config.js                 # Tailwind + PrimeVue theme + custom vars
│   ├── postcss.config.js
│   └── package.json
│
├── server/                   # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── services/
│   │   │   ├── yoloLive.service.ts            # YOLO detection handler
│   │   │   ├── trafficSignal.service.ts       # State machine + manual mode + configurable durations
│   │   │   ├── arduinoSerial.ts               # Serial port + commands (enhanced)
│   │   │   └── socketIoBroadcaster.ts         # Socket.io events + audit logging
│   │   ├── routes/
│   │   │   ├── signal.routes.ts               # Manual control + config endpoints
│   │   │   ├── yolo.routes.ts                 # Detection webhook endpoints
│   │   │   └── health.routes.ts               # Health check endpoints
│   │   ├── config/
│   │   │   └── env.ts                         # Environment schema (enhanced)
│   │   ├── types/
│   │   │   └── index.ts                       # Shared types (Signal, Traffic, Pedestrian, AuditEntry)
│   │   └── server.ts                          # Express app + Socket.io + audit log storage
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
├── .env                      # Root .env for shared config
└── README.md
```

---

## 4–9. [UNCHANGED] Python Setup, Validation, JSON Contract, Camera, Detector, FastAPI

*(Sections 4–9 remain identical to the original spec. Refer to original document.)*

---

## 10. [UPDATED] Node.js Server Integration — Manual Mode + YOLO Activation

### 10.1 System State (UPDATED with manual mode + configurable durations + audit)

```typescript
interface SystemState {
  // Traffic & Pedestrian State
  traffic: 'GREEN' | 'YELLOW' | 'RED';
  pedestrianState: 'WALK' | 'DONT_WALK';
  
  // Timers (seconds remaining)
  trafficTimerSec: number | null;      // null = "not active"
  pedestrianTimerSec: number | null;
  
  // Configurable durations (from .env, adjustable per-cycle via API)
  greenDurationSec: number;            // From TRAFFIC_GREEN_DURATION_MS / 1000
  yellowDurationSec: number;           // From TRAFFIC_YELLOW_DURATION_MS / 1000
  redDurationSec: number;              // From TRAFFIC_RED_DURATION_MS / 1000
  
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
  currentCycleDurationSec: number;     // Which duration is currently counting
  
  // Hardware Health
  arduinoOnline: boolean;
  cameraOnline: boolean;
  
  // Audit
  lastAuditEntry: AuditEntry | null;
}

interface AuditEntry {
  id: number;
  timestamp: string;                   // ISO format date/time
  event: 'MANUAL_GREEN' | 'MANUAL_YELLOW' | 'MANUAL_RED' | 'MANUAL_UNLOCK' | 'YOLO_TRIGGER' | 'CONFIG_CHANGE';
  details: string;
  arduinoState: 'NORMAL_TRAFFIC' | 'CAUTION_TRAFFIC' | 'STOP_TRAFFIC';
  durationSec?: number;
}
```

### 10.2 Configuration (ENHANCED SECTION)

Add to `backend/.env`:

```env
# Traffic Light Timing (milliseconds)
TRAFFIC_GREEN_DURATION_MS=30000      # 30 seconds (default, adjustable via API)
TRAFFIC_YELLOW_DURATION_MS=3000      # 3 seconds (default, adjustable via API)
TRAFFIC_RED_DURATION_MS=20000        # 20 seconds (default, adjustable via API)

# YOLO Detection Timing
YOLO_PEDESTRIAN_THRESHOLD_MS=5000    # Pedestrian must be visible 5s to trigger
YOLO_DETECTION_PUBLISH_INTERVAL_MS=200 # Publish detection JSON every 200ms

# Manual Mode
MANUAL_LOCK_TIMEOUT_MS=60000         # Manual lock expires after 60 s
MANUAL_MODE_ENABLED=true
YOLO_MODE_ENABLED=true               # Can both be true; manual takes priority

# Audit Logging (lightweight)
AUDIT_ENABLED=true                     # Enable/disable audit logging
AUDIT_MAX_ENTRIES=100                # Max entries in memory (oldest auto-removed)
AUDIT_PERSIST_TO_FILE=false           # Set true for file-based persistence (Docker)

# Arduino SERIAL
ARDUINO_PORT=COM3                    # Windows: COM3, COM4, etc.
ARDUINO_BAUD=9600
ARDUINO_CONNECT_TIMEOUT_MS=5000

# SOCKET.IO
SOCKET_IO_PATH=/socket.io
SOCKET_IO_RECONNECT_DELAY=1000
SOCKET_IO_MAX_HTTP_BUFFER_SIZE=1e6
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

**END OF UPDATED MASTERPLAN**