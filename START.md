# How to Start the Pedestrian Crosswalk System

Local, real-time pipeline:

```
Webcam → Python YOLO (:8000) → Node backend (:4000) → Vue dashboard (:5173) → Arduino (USB serial)
```

Run all three services below in **separate terminals**. Start them in this order: **Python → Backend → Frontend**.

> **Login / dashboard only?** You only need **Backend + Frontend**. Do not start the Python YOLO service until you want the live webcam feed — if it is running, it POSTs to `/api/yolo/detection` about 5 times per second (that is normal, not related to login).

> **Upload detection (Detections page)?** You need **Python YOLO + Backend + Frontend**. The backend calls `POST http://localhost:8000/detect/video` to produce an **annotated MP4 with bounding boxes** plus snapshot JPEG frames. Set `DETECTION_MOCK=false` in `backend/.env`. Old uploads processed while mock mode was on will not have real boxes — re-upload after yolo-service is running.

---

## Prerequisites

- **Webcam** connected (default index `0`)
- **Python 3** with the `yolo-service` virtual environment set up
- **Node.js 20+** for backend and frontend
- **PostgreSQL** reachable (backend uses the DB configured in `backend/.env`)

### First-time database setup (run once)

Before you can log in, migrate the schema and seed the admin account:

```powershell
cd "d:\group11 thesis\backend"
npm run db:setup
```

This runs `db:migrate` (creates tables) then `db:seed` (creates/updates the admin user). Run it again any time login fails after a fresh database or credential change.

### Login account (seeded admin)

After seeding, sign in at **http://localhost:5173/login** with:

| Field | Value |
|-------|-------|
| **Email** | `admin@thesis.local` |
| **Password** | the `ADMIN_PASSWORD` value in `backend/.env` |
| **Role** | `admin` (full access, including manual traffic override and Staff page) |

If login fails with invalid credentials, re-run `npm run db:seed` — it creates or updates this admin user from `backend/.env`.

### One-time Python setup

If you have not set up the YOLO service yet:

```powershell
cd "d:\group11 thesis\yolo-service"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The trained model should be at `yolo-service/models/best.pt` (copied from `yolobackend/best.pt`).

### Optional: validate model + camera

```powershell
cd "d:\group11 thesis\yolo-service"
.venv\Scripts\Activate.ps1
python _validate.py
```

Press **q** to quit. Note the printed `Class names:` output.

> **Stopping yolo-service:** Press **Ctrl+C once** and wait a few seconds for shutdown. If the dashboard live feed is open, you may see `CancelledError` / `KeyboardInterrupt` lines — that is normal Windows/asyncio cleanup, not a runtime failure. Pressing Ctrl+C twice forces an immediate quit and prints more noise.

> **Windows note:** If Python fails with an error about `torch_python.dll` being blocked, your Application Control policy is blocking PyTorch. Allow PyTorch in your security settings, then retry.

### Optional: Arduino

Full wiring diagram, **complete upload code**, and web integration steps:

→ **[`backend/arduino/ARDUINO_UNO_GUIDE.md`](backend/arduino/ARDUINO_UNO_GUIDE.md)**

Quick summary:

1. Wire **Green → D9**, **Yellow → D10**, **Red → D11** (each with a **220 Ω** resistor to GND).
2. **Upload the sketch** from `backend/arduino/traffic_light/traffic_light.ino` using Arduino IDE (required — plug-in alone is not enough).
3. In `backend/.env`, set:
   ```env
   YOLO_LIVE_ARDUINO_TRANSPORT=serial
   YOLO_LIVE_ARDUINO_PORT=COM3
   ```
   Replace `COM3` with your port (check Device Manager → Ports).
4. Test in Serial Monitor: `PING` → `PONG`, `STOP_TRAFFIC` → red LED, `NORMAL_TRAFFIC` → green LED.

Without Arduino hardware, leave `YOLO_LIVE_ARDUINO_TRANSPORT=log` — commands are logged in the backend terminal only.

---

## Terminal 1 — Python YOLO service (port 8000)

```powershell
cd "d:\group11 thesis\yolo-service"
.venv\Scripts\Activate.ps1
python app.py
```

**Expect:** Uvicorn running on `http://localhost:8000`

**Quick checks (browser):**

| URL | Purpose |
|-----|---------|
| http://localhost:8000/health | Service health |
| http://localhost:8000/video | Live annotated MJPEG feed (primary camera) |
| http://localhost:8000/video/{index} | Live annotated MJPEG feed per camera |

Config: `yolo-service/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `YOLO_MODEL` | `models/best.pt` | Model weights path |
| `AUTO_DISCOVER_CAMERAS` | `true` | Start a stream for every webcam found at startup |
| `FUSION_MODE` | `OR` | `OR` = any camera detecting drives the signal; `AND` = all cameras must detect |
| `CAMERA_INDEXES` | *(empty)* | Explicit camera list, e.g. `0,2` — overrides auto-discovery |
| `CAMERA_INDEX` | `0` | Fallback webcam index when nothing is discovered |
| `PYTHON_PORT` | `8000` | FastAPI port |
| `NODE_SERVER_URL` | `http://localhost:4000` | Backend URL for detection POSTs |
| `CONFIDENCE_THRESHOLD` | `0.5` | Minimum detection confidence |
| `INFERENCE_INTERVAL` | `0.12` | Seconds between YOLO runs (~8 FPS detection) |
| `STREAM_FPS` | `25` | Live MJPEG display frame rate (smooth video) |
| `POST_INTERVAL` | `0.5` | Backend heartbeat interval (also posts immediately on detection change) |
| `CAPTURE_BUFFER_SIZE` | `1` | Webcam buffer size — keep at `1` for lowest lag |
| `MAX_CAMERA_INDEX` | `10` | Highest index to probe when listing webcams |

**Camera input:** At startup the service **auto-discovers every connected webcam** (up to `MAX_CAMERA_INDEX`) and runs a separate detection stream for each. Set `CAMERA_INDEXES=0,2` in `yolo-service/.env` to pin specific cameras. On the dashboard, each camera gets its own tile in the multi-camera grid; use the **Camera input** dropdown to switch the primary camera without restarting the service.

**API (camera switch):**

| URL | Method | Purpose |
|-----|--------|---------|
| http://localhost:8000/cameras | GET | List available webcams |
| http://localhost:8000/cameras/select | POST | Switch active webcam (`{"index": 1}`) |

**Live output:** Capture, inference, and display run on **separate threads** — video stays smooth (~25 FPS) while YOLO detects pedestrians ~8 times per second and draws **one** bounding box on the latest frame (highest-confidence pedestrian only).

---

## Terminal 2 — Backend (port 4000)

```powershell
cd "d:\group11 thesis\backend"
npm run dev
```

**Expect:** `API server listening on http://0.0.0.0:4000`

The backend:

- Receives detection JSON at `POST /api/yolo/detection`
- Applies the **5 second** sustained-detection rule → sends `STOP_TRAFFIC`
- After **15 seconds** → sends `NORMAL_TRAFFIC`
- Broadcasts live state over **WebSocket** at `ws://localhost:4000`

**Useful endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | API health |
| GET | `/api/system/status` | Full live system state |
| GET | `/api/yolo/status` | YOLO / detection state |
| GET | `/api/arduino/status` | Arduino connection state |
| POST | `/api/yolo/detection` | Detection ingest (called by Python) |

Live YOLO env vars in `backend/.env` (defaults shown):

```env
YOLO_LIVE_DETECTION_THRESHOLD_MS=5000
YOLO_LIVE_STOP_DURATION_MS=15000
YOLO_LIVE_ARDUINO_TRANSPORT=log
YOLO_LIVE_ARDUINO_PORT=COM3
YOLO_LIVE_ARDUINO_BAUD=9600
```

---

## Terminal 3 — Frontend (port 5173)

```powershell
cd "d:\group11 thesis\frontend"
npm run dev
```

**Expect:** `Local: http://localhost:5173`

Open **http://localhost:5173/login** and sign in with the seeded admin account (see [Login account](#login-account-seeded-admin) above), then open the **Dashboard**.

Config: `frontend/.env`

```env
VITE_YOLO_VIDEO_URL=http://localhost:8000/video
VITE_WS_URL=ws://localhost:4000
```

---

## What you should see on the Dashboard

| Panel | Data source |
|-------|-------------|
| **Live Multi-Camera Grid** (one tile per webcam, each with its own stream, status badge, and detections) | Python MJPEG streams (`:8000/video/{index}`) + WebSocket from backend (`:4000`) |
| **Live Detection** (YOLO, Camera, Arduino, Traffic, count, confidence) | WebSocket from backend (`:4000`) |
| **Traffic Signal** / **Recent detections** | Existing REST API (upload-based flow) |

### End-to-end behavior

1. Pedestrian enters a webcam frame.
2. Python runs detection **per camera** (each camera can detect multiple pedestrians), fuses the results (any camera detecting drives the signal — `FUSION_MODE=OR`) and streams annotated video + JSON to the backend.
3. After **5 continuous seconds** of fused detection → backend sends **one** `STOP_TRAFFIC`.
4. Traffic stays stopped for **15 seconds** → backend sends **one** `NORMAL_TRAFFIC`.
5. Dashboard updates in real time without refreshing the page.

---

## Port summary

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express) | http://localhost:4000 |
| Python YOLO (FastAPI) | http://localhost:8000 |
| WebSocket | ws://localhost:4000 |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Python crashes on startup | PyTorch blocked by Windows policy | Allow `torch_python.dll` / run outside restricted policy |
| `/video` is blank | Webcam not found | Change `CAMERA_INDEX` in `yolo-service/.env` |
| Live panel says "Waiting for live system state…" | Backend not running | Start Terminal 2 |
| YOLO / Camera show **OFFLINE** | Python not running or not posting | Start Terminal 1; confirm `NODE_SERVER_URL` points to `:4000` |
| Arduino shows **OFFLINE** | Serial not configured or wrong port | Set `YOLO_LIVE_ARDUINO_TRANSPORT=serial` and correct `COM` port |
| Feed works but no traffic stop | Detection not sustained 5s | Stand in frame continuously for 5+ seconds |
| CORS / login issues | Backend not reachable | Confirm backend is on port 4000 and DB is connected |
| Login fails / invalid credentials | Admin not seeded | Run `npm run db:seed` in `backend/`; check `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env` |

---

## Stop the system

In each terminal, press **Ctrl+C** to stop that service. Stop in reverse order if you like: Frontend → Backend → Python.
