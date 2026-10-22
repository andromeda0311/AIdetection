# AI-Driven Pedestrian Crosswalk System — Architecture Overview

## System Overview

This is a **local, real-time pipeline** for pedestrian detection at crosswalks using a custom-trained YOLO model. The system detects pedestrians via webcam, streams annotated video, applies timing logic, and controls a physical traffic light via Arduino.

```
┌─────────────┐     MJPEG + JSON      ┌─────────────┐     WebSocket     ┌─────────────┐
│   Webcam    │ ────────────────────► │  Python     │ ────────────────► │   Node.js   │
│             │                       │  YOLO       │                   │   Backend   │
└─────────────┘                       │  Service    │                   │  (Express)  │
         │                            │  (:8000)    │                   └──────┬──────┘
         │                             └─────────────┘                          │
         │                                    │                                 │
         │                                    │ REST POST                        │ Serial
         │                                    ▼                                 ▼
         │                            ┌─────────────┐                   ┌─────────────┐
         └──────────────────────────► │   Vue.js    │                   │   Arduino   │
                                      │  Frontend   │                   │   Uno       │
                                      │  (:5173)    │                   │  (COM3)     │
                                      └─────────────┘                   └─────────────┘
```

## Component Architecture

### 1. Python YOLO Service (`yolo-service/`) — Port 8000

**Purpose:** Camera capture (auto-discovered multi-camera), YOLO inference per camera, frame annotation, MJPEG streaming, detection fusion + publishing.

**Key Files:**
- `app.py` — FastAPI server with endpoints `/health`, `/video`, `/video/{index}`, `/cameras`, `/cameras/select`, `/detect/video`
- `camera.py` — Three-thread pipeline (Capture → Inference → Display)
- `detector.py` — YOLO model wrapper with confidence filtering and box drawing
- `camera_utils.py` — Camera enumeration helpers
- `video_processor.py` — Offline video file processing

**Data Flow:**
```
Webcam → Capture Thread (read frames ASAP)
            ↓
Inference Thread (YOLO every ~0.12s, max_det=1)
            ↓
Display Thread (draw boxes, resize to 480×360, encode JPEG @ 25 FPS)
            ↓
MJPEG Stream (/video) ──────► Frontend <img> tag
            ↓
Publish Loop (POST to Node.js /api/yolo/detection @ ~5 Hz + on state change)
```

**Detection JSON Contract (fused multi-camera payload):**
```json
{
  "timestamp": 1755000000000,
  "detected": true,
  "count": 1,
  "fusionMode": "AND",
  "degraded": false,
  "detections": [{
    "class": "pedestrian",
    "confidence": 0.94,
    "x1": 120, "y1": 80, "x2": 340, "y2": 420
  }],
  "frameWidth": 640,
  "frameHeight": 480,
  "cameras": [{
    "index": 0,
    "online": true,
    "detected": true,
    "count": 1,
    "detections": [{ "class": "pedestrian", "confidence": 0.94, "x1": 120, "y1": 80, "x2": 340, "y2": 420 }],
    "frameWidth": 640,
    "frameHeight": 480
  }]
}
```

**Fusion logic (`fusion.py`):** configurable via `FUSION_MODE` — `OR` (default) = any online camera detecting drives the signal; `AND` = all online cameras must detect simultaneously. When only one camera is online, its detection drives the signal (OR_FALLBACK) and the payload is flagged `degraded` when fewer cameras are online than configured.

**Config (`yolo-service/.env`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `YOLO_MODEL` | `models/best.pt` | Trained weights |
| `AUTO_DISCOVER_CAMERAS` | `true` | Start a stream for every webcam found at startup |
| `FUSION_MODE` | `OR` | `OR` = any camera detecting drives the signal; `AND` = all cameras must detect |
| `CAMERA_INDEXES` | *(empty)* | Explicit camera list, e.g. `0,2` — overrides auto-discovery |
| `CAMERA_INDEX` | `0` | Fallback webcam index when nothing is discovered |
| `PYTHON_PORT` | `8000` | FastAPI port |
| `NODE_SERVER_URL` | `http://localhost:4000` | Backend for detection POSTs |
| `CONFIDENCE_THRESHOLD` | `0.5` | Min confidence |
| `INFERENCE_INTERVAL` | `0.12` | Seconds between YOLO runs (~8 FPS) |
| `STREAM_FPS` | `25` | MJPEG output frame rate |
| `POST_INTERVAL` | `0.5` | Heartbeat + state-change POST interval |

---

### 2. Node.js Backend (`backend/`) — Port 4000

**Purpose:** Central state, WebSocket broadcast, timing logic (5s/15s), Arduino serial commands, REST API, auth, database.

**Key Files:**
- `src/server.ts` — HTTP + WebSocket server entry point
- `src/app.ts` — Express middleware, routes
- `src/routes/yolo.routes.ts` — Live YOLO endpoints
- `src/controllers/yolo.controller.ts` — Thin handlers
- `src/services/yoloLive.service.ts` — **Core live pipeline logic**
- `src/services/arduinoSerial.shared.ts` — Serial port wrapper
- `src/services/trafficSignal.service.ts` — Upload-based signal control (legacy)
- `src/config/env.ts` — Environment config
- `src/db/schema.sql` — PostgreSQL schema

**Live Pipeline Logic (`yoloLive.service.ts`):**

```
Detection POST received
         │
         ▼
Update systemState (yolo=online, camera=online, pedestrianDetected, count, confidence)
         │
         ▼
If detected & detectionStartedAt == null → detectionStartedAt = now
         │
         ▼
detectionDuration = (now - detectionStartedAt) / 1000
         │
         ▼
If detectionDuration >= 5s AND !trafficCycleActive → beginPedestrianCycle()
         │
         ▼
beginPedestrianCycle():
  traffic = 'caution' → sendArduino('CAUTION_TRAFFIC')
  wait yellowDurationMs (default 3000ms)
  traffic = 'stopped' → sendArduino('STOP_TRAFFIC')
  wait stopDurationMs (default 15000ms)
  traffic = 'normal' → sendArduino('NORMAL_TRAFFIC')
  trafficCycleActive = false
```

**System State (single source of truth):**
```typescript
interface SystemState {
  yolo: 'online' | 'offline';
  camera: 'online' | 'offline';
  arduino: 'online' | 'offline';
  traffic: 'normal' | 'caution' | 'stopped';
  pedestrianDetected: boolean;
  pedestrianCount: number;
  confidence: number;
  detectionDuration: number;    // seconds of continuous detection
  detections: LiveDetectionBox[];
  frameWidth: number;
  frameHeight: number;
  cameras: CameraLiveView[];
  fusionMode: string;
  degraded: boolean;
  updatedAt: number;
}
```

**WebSocket Broadcast:**
- Connected clients receive `{ type: 'system_status', payload: SystemState }`
- Throttled to 500ms, but broadcasts immediately on signature change

**REST Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | API + DB health |
| POST | `/api/yolo/detection` | Ingest detection from Python |
| GET | `/api/yolo/status` | YOLO live state |
| GET | `/api/arduino/status` | Arduino connection state |
| GET | `/api/system/status` | Full system state |
| GET/POST | `/api/auth/*` | JWT auth (login, refresh) |
| GET/POST | `/api/staff/*` | Staff management (admin) |
| GET/POST | `/api/detections/*` | Upload-based video detection |
| GET/POST | `/api/signal/*` | Legacy traffic signal control |

**Config (`backend/.env`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Express port |
| `DB_*` | — | Aiven PostgreSQL connection |
| `JWT_*` | — | Access/refresh secrets & TTL |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |
| `DETECTION_MOCK` | `true` | Mock mode for upload detection |
| `SIGNAL_TRANSPORT` | `log` | `log` or `serial` for upload flow |
| `YOLO_LIVE_DETECTION_THRESHOLD_MS` | `5000` | 5s sustained detection |
| `YOLO_LIVE_STOP_DURATION_MS` | `15000` | 15s traffic stop |
| `YOLO_LIVE_ARDUINO_TRANSPORT` | `log` | `log` or `serial` for live flow |
| `YOLO_LIVE_ARDUINO_PORT` | `COM3` | Arduino serial port |
| `YOLO_LIVE_ARDUINO_BAUD` | `9600` | Serial baud rate |

---

### 3. Vue.js Frontend (`frontend/`) — Port 5173

**Purpose:** Presentation only — renders MJPEG stream, WebSocket state, and REST-driven views.

**Key Files:**
- `src/main.ts` — App bootstrap (Pinia, PrimeVue, Router)
- `src/router/index.ts` — Routes with auth guards
- `src/stores/auth.ts` — JWT auth state (access/refresh tokens)
- `src/composables/useLiveSystemState.ts` — **WebSocket + polling fallback**
- `src/views/DashboardView.vue` — Main dashboard
- `src/components/dashboard/LiveStage.vue` → `LiveDetectionPanel.vue` — Live video + state
- `src/components/dashboard/SystemHealthRail.vue` — YOLO/Camera/Arduino status
- `src/components/dashboard/SignalControlCard.vue` — Manual traffic override
- `src/components/dashboard/RecentDetectionsCard.vue` — Upload history
- `src/components/dashboard/EventLogCard.vue` — Signal event log
- `src/views/DetectionsView.vue` — Upload video for detection
- `src/views/DetectionDetailView.vue` — Annotated video + frames
- `src/views/StaffView.vue` — Admin staff management
- `src/api/*.ts` — Typed API clients (REST + WebSocket URLs from env)

**Live System State Composables (`useLiveSystemState.ts`):**
```typescript
// WebSocket connection with exponential backoff reconnect
// Polling fallback every 1s via GET /api/system/status
// Returns { liveState: Ref<LiveSystemState | null>, connected: Ref<boolean> }
```

**Live Multi-Camera Display (`MultiCameraGrid.vue`):**
```vue
<!-- One tile per camera: per-camera MJPEG stream, status badge, detections -->
<img v-for="camera in cameras" :src="`${yoloApiBase}/video/${camera.index}?t=${cacheBust}`" />
<!-- Tiles come from liveState.cameras (WebSocket); fallback: GET /cameras from Python -->
```

**Config (`frontend/.env`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_YOLO_VIDEO_URL` | `http://localhost:8000/video` | MJPEG stream URL |
| `VITE_WS_URL` | `ws://localhost:4000` | WebSocket URL |

---

### 4. Arduino Uno (`backend/arduino/traffic_light/traffic_light.ino`)

**Purpose:** Physical traffic light state machine. Receives high-level commands via USB serial.

**Wiring:**
| LED | Pin | Resistor |
|-----|-----|----------|
| Green | D9 | 220 Ω to GND |
| Yellow | D10 | 220 Ω to GND |
| Red | D11 | 220 Ω to GND |

**Commands (newline-terminated):**
| Command | Action | Response |
|---------|--------|----------|
| `PING` | Health check | `PONG` |
| `CAUTION_TRAFFIC` | Yellow only | `TRAFFIC_CAUTION` |
| `STOP_TRAFFIC` | Red only | `TRAFFIC_STOPPED` |
| `NORMAL_TRAFFIC` | Green only | `TRAFFIC_NORMAL` |

**State Machine (Arduino-owned):**
```
NORMAL (Green) ──CAUTION_TRAFFIC──► CAUTION (Yellow) ──STOP_TRAFFIC──► STOPPED (Red)
      ▲                                                                    │
      │                                                                    │
      └────────────── NORMAL_TRAFFIC (after 15s timer in Node.js) ────────┘
```

**Config:** `YOLO_LIVE_ARDUINO_TRANSPORT=serial` + `YOLO_LIVE_ARDUINO_PORT=COM3` in `backend/.env`

---

## End-to-End Data Flow

### Live Webcam Pipeline (Real-time)

```
1. Webcam captures frame
         │
2. Python CameraStream.capture_loop() reads frame (thread 1)
         │
3. Python CameraStream.inference_loop() runs YOLO every 120ms (thread 2)
         │   - Resizes to max 320px for speed
         │   - max_det=1 (single highest-confidence pedestrian)
         │   - Filters by CONFIDENCE_THRESHOLD (0.5)
         │   - Maps boxes back to original frame size
         │
4. Python CameraStream.display_loop() draws boxes, resizes to 480×360, encodes JPEG @ 25 FPS (thread 3)
         │
5. GET /video/{index} → MJPEG stream per camera → Frontend multi-camera grid tiles display live annotated feeds
         │
5. Python publish_detections_loop() POSTs detection JSON to Node.js /api/yolo/detection
         │   - Every 0.5s (heartbeat)
         │   - Immediately on state change (detected ↔ not detected, count change, confidence > 0.01)
         │
6. Node.js yoloLive.handleDetection() updates systemState
         │   - Tracks continuous detection duration
         │   - At 5s sustained → beginPedestrianCycle()
         │   - CAUTION (3s) → STOP_TRAFFIC → wait 15s → NORMAL_TRAFFIC
         │
7. Node.js broadcasts SystemState via WebSocket to all connected frontend clients
         │
8. Frontend useLiveSystemState receives message, updates reactive liveState
         │
9. Dashboard components (LiveDetectionPanel, SystemHealthRail, SignalControlCard) re-render
```

### Upload-Based Video Detection (Async)

```
1. User uploads video file on /detections page
         │
2. Frontend POST /api/detections (multipart/form-data) → Backend
         │
3. Backend saves to storage/uploads/, calls Python POST /detect/video
         │
4. Python video_processor.process_video_file():
         │   - Reads video frame by frame
         │   - Runs YOLO on each frame (full inference, not live pipeline)
         │   - Writes annotated MP4 + extracts JPEG frames
         │   - Returns base64-encoded video + frame metadata
         │
5. Backend saves results to storage/detections/{uuid}/, stores metadata in PostgreSQL
         │
6. Frontend polls /api/detections, shows results in DetectionsView
         │
7. Click detection → DetectionDetailView shows annotated video + frame gallery
```

---

## Port Summary

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend (Vite) | `http://localhost:5173` | Dashboard, upload, auth |
| Backend (Express) | `http://localhost:4000` | REST API, WebSocket |
| Backend WebSocket | `ws://localhost:4000` | Live system state push |
| Python YOLO (FastAPI) | `http://localhost:8000` | MJPEG, detection POST target, camera mgmt |
| Python YOLO Health | `http://localhost:8000/health` | Service health check |
| Python YOLO Video | `http://localhost:8000/video` | Live MJPEG stream (primary camera) |
| Python YOLO Video (per camera) | `http://localhost:8000/video/{index}` | Live MJPEG stream per camera |
| Arduino Serial | `COM3` @ 9600 | Physical traffic light |

---

## Startup Sequence

```powershell
# Terminal 1: Python YOLO Service
cd "D:\group11 thesis\yolo-service"
.venv\Scripts\Activate.ps1
python app.py
# Expect: "Uvicorn running on http://0.0.0.0:8000"

# Terminal 2: Backend
cd "D:\group11 thesis\backend"
npm run dev
# Expect: "API server listening on http://0.0.0.0:4000"
#         "WebSocket server ready for live YOLO state"

# Terminal 3: Frontend
cd "D:\group11 thesis\frontend"
npm run dev
# Expect: "Local: http://localhost:5173"
```

**First-time DB setup:**
```powershell
cd "D:\group11 thesis\backend"
npm run db:setup  # Runs migrate + seed
```

**Login:** `admin@thesis.local` / the `ADMIN_PASSWORD` value in `backend/.env` (seeded admin)

---

## Configuration Coupling

| Change | Files to Update |
|--------|-----------------|
| Backend port | `backend/.env` PORT, `yolo-service/.env` NODE_SERVER_URL, `frontend/.env` VITE_WS_URL, `backend/.env` CORS_ORIGIN |
| Frontend port | `backend/.env` CORS_ORIGIN |
| Python port | `yolo-service/.env` PYTHON_PORT, `frontend/.env` VITE_YOLO_VIDEO_URL |
| Arduino port | `backend/.env` YOLO_LIVE_ARDUINO_PORT, `backend/.env` SIGNAL_SERIAL_PORT |
| DB credentials | `backend/.env` DB_* |

---

## Key Design Decisions

1. **Separation of Concerns (Fixed):**
   - Python: Camera + YOLO + video stream only
   - Node.js: State machine, timing, Arduino, WebSocket, auth, DB
   - React: Presentation only (no inference, no business logic)
   - Arduino: Physical light state machine

2. **Timing in Node.js:** 5s detection threshold and 15s stop duration live in backend — single source of truth.

3. **MJPEG over WebRTC:** Simplicity first; MJPEG works in `<img>` tag without extra libraries.

4. **Three-thread Python pipeline:** Decouples capture (lowest latency), inference (heavy), display (smooth video).

5. **max_det=1 in live mode:** Shows only highest-confidence pedestrian box to reduce visual clutter.

6. **WebSocket + polling fallback:** Primary real-time path with REST fallback for resilience.

7. **Two detection modes:**
   - **Live:** Webcam → Python → Node.js → Dashboard → Arduino (real-time)
   - **Upload:** Video file → Backend → Python → Backend → DB → Dashboard (async)

---

## Troubleshooting Quick Reference

| Symptom | Check |
|---------|-------|
| Python crashes on startup | Windows blocking `torch_python.dll` — allow in security policy |
| `/video` blank | Wrong `CAMERA_INDEX` in `yolo-service/.env` |
| "Waiting for live system state…" | Backend not running (Terminal 2) |
| YOLO/Camera OFFLINE | Python not running or `NODE_SERVER_URL` wrong |
| Arduino OFFLINE | `YOLO_LIVE_ARDUINO_TRANSPORT=serial` + correct COM port |
| No traffic stop | Stand in frame continuously for 5+ seconds |
| Login fails | Run `npm run db:seed` in backend; check `ADMIN_EMAIL`/`ADMIN_PASSWORD` |
| CORS errors | `CORS_ORIGIN` in `backend/.env` matches frontend URL |

---

## File Structure Summary

```
project/
├── backend/                 # Node.js Express + WebSocket server
│   ├── src/
│   │   ├── server.ts        # HTTP + WS entry
│   │   ├── app.ts           # Express setup
│   │   ├── config/env.ts    # Config (Zod-validated)
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, validation, rate-limit, errors
│   │   ├── models/          # DB models (StaffUser, Detection, etc.)
│   │   ├── routes/          # API route modules
│   │   ├── services/        # Business logic (yoloLive, arduino, trafficSignal)
│   │   ├── db/              # Schema, migrate, seed
│   │   └── utils/           # Logger, ApiError, response helpers
│   ├── storage/             # Uploads + detection artifacts
│   ├── arduino/             # Arduino sketch + wiring guide
│   ├── .env                 # Backend config (DB, JWT, YOLO live, Arduino)
│   └── package.json
├── frontend/                # Vue 3 + Vite + PrimeVue
│   ├── src/
│   │   ├── main.ts          # Bootstrap
│   │   ├── App.vue          # Root + Toast
│   │   ├── router/          # Vue Router + auth guards
│   │   ├── stores/          # Pinia (auth)
│   │   ├── composables/     # useLiveSystemState, useTheme
│   │   ├── views/           # Dashboard, Detections, Login, Staff
│   │   ├── components/      # UI + dashboard components
│   │   ├── api/             # Typed REST + WS clients
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── styles/          # CSS (CSS variables, PrimeVue overrides)
│   ├── .env                 # VITE_YOLO_VIDEO_URL, VITE_WS_URL
│   └── package.json
├── yolo-service/            # Python FastAPI + YOLO
│   ├── app.py               # FastAPI + lifespan + endpoints
│   ├── camera.py            # 3-thread capture/inference/display
│   ├── detector.py          # YOLO wrapper + box drawing
│   ├── camera_utils.py      # Camera enumeration
│   ├── video_processor.py   # Offline video processing
│   ├── models/best.pt       # Trained weights
│   ├── requirements.txt
│   └── .env                 # YOLO_MODEL, CAMERA_INDEX, NODE_SERVER_URL
├── yolobackend/             # Legacy/model source (best.pt copy)
├── START.md                 # Quick start guide
├── masterplan.md            # Full implementation spec
├── ENV.md                   # Environment variable reference
└── ARCHITECTURE.md          # This file
```

---

## Security Notes

- **Development only:** Hardcoded secrets in `ENV.md` and `.env` files are for local thesis demo.
- **JWT secrets:** Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` before any production use.
- **Database:** Aiven PostgreSQL credentials in `backend/.env` — rotate if repo becomes public.
- **CORS:** Locked to `http://localhost:5173` in development.
- **Arduino:** Serial transport runs on host machine — not containerized.

---

*Generated from codebase analysis. Keep in sync with `START.md`, `masterplan.md`, and `ENV.md`.*