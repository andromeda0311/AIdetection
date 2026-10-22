# Environment Variables & Credentials

> **Private repository only.** This file contains real credentials for local development.  
> Do **not** commit this file if the repo ever becomes public. Add `ENV.md` to `.gitignore` in that case.

Copy each block below into the matching `.env` file before starting the system.  
See [START.md](./START.md) for how to run all services.

---

## File locations

| Service | Env file |
|---------|----------|
| Backend (Node/Express) | `backend/.env` |
| Frontend (Vue/Vite) | `frontend/.env` |
| Python YOLO service | `yolo-service/.env` |

---

## Backend — `backend/.env`

```env
# Application
NODE_ENV=development
HOST=0.0.0.0
PORT=4000
LOG_LEVEL=info

# Database (PostgreSQL)
DB_NAME=<database name>
DB_HOST=<database host>
DB_PORT=5432
DB_USER=<database user>
DB_PASSWORD=<database password>
DB_SSL=true

# Optional single connection string (alternative to DB_* above)
# DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>?sslmode=require

# JWT - generate each with: openssl rand -hex 48 (use two different values)
JWT_ACCESS_SECRET=<random 96-character hex string>
JWT_REFRESH_SECRET=<different random 96-character hex string>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Refresh token cookie
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Seed admin account (used by npm run db:seed)
ADMIN_EMAIL=admin@thesis.local
ADMIN_PASSWORD=<strong password, at least 8 characters>

# File uploads (video detection)
UPLOAD_DIR=./storage
UPLOAD_MAX_FILE_SIZE_MB=200
UPLOAD_MAX_FILES_PER_REQUEST=1
UPLOAD_ALLOWED_EXTENSIONS=mp4,mov,avi,mkv,webm,m4v
UPLOAD_ALLOWED_MIME_TYPES=video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm

# Detection API (mock until the real YOLO API is provided)
DETECTION_MOCK=true
DETECTION_API_URL=
DETECTION_API_KEY=
DETECTION_API_TIMEOUT_MS=120000
DETECTION_MOCK_PEDESTRIANS=1

# Traffic signal — upload-based flow (GREEN / YELLOW / RED)
# serial -> requires the backend running on the host PC, not in Docker on Windows.
SIGNAL_TRANSPORT=log
SIGNAL_SERIAL_PORT=COM3
SIGNAL_BAUD=9600
SIGNAL_YELLOW_MS=3000
SIGNAL_RED_MS=20000
SIGNAL_CLEAR_GRACE_MS=2000
SIGNAL_ARDUINO_URL=

# Live YOLO webcam pipeline (Python -> Node -> Dashboard -> Arduino)
YOLO_LIVE_DETECTION_THRESHOLD_MS=5000
YOLO_LIVE_STOP_DURATION_MS=15000
YOLO_LIVE_ARDUINO_TRANSPORT=log
YOLO_LIVE_ARDUINO_PORT=COM3
YOLO_LIVE_ARDUINO_BAUD=9600
```

### Backend credentials quick reference

| Key | Value |
|-----|-------|
| API URL | `http://localhost:4000` |
| WebSocket URL | `ws://localhost:4000` |
| Admin email | `admin@thesis.local` |
| Admin password | the `ADMIN_PASSWORD` value in `backend/.env` |
| DB host | the `DB_HOST` value in `backend/.env` |
| DB port | the `DB_PORT` value in `backend/.env` |
| DB name | `defaultdb` |
| DB user | the `DB_USER` value in `backend/.env` |
| DB password | the `DB_PASSWORD` value in `backend/.env` |

### When using Arduino hardware (live pipeline)

Change these in `backend/.env`:

```env
YOLO_LIVE_ARDUINO_TRANSPORT=serial
YOLO_LIVE_ARDUINO_PORT=COM3
```

Replace `COM3` with your Arduino port from Device Manager.

---

## Frontend — `frontend/.env`

```env
# Base URL of the backend API. Leave unset to use the Vite dev proxy (/api -> http://localhost:4000).
# VITE_API_URL=http://localhost:4000/api

# Live YOLO MJPEG stream (Python service)
VITE_YOLO_VIDEO_URL=http://localhost:8000/video

# WebSocket URL for live system state
VITE_WS_URL=ws://localhost:4000
```

### Frontend URLs quick reference

| Key | Value |
|-----|-------|
| App URL | `http://localhost:5173` |
| YOLO video stream | `http://localhost:8000/video` |
| WebSocket | `ws://localhost:4000` |

---

## Python YOLO — `yolo-service/.env`

```env
YOLO_MODEL=models/best.pt
AUTO_DISCOVER_CAMERAS=true
FUSION_MODE=OR
CAMERA_INDEXES=
CAMERA_INDEX=0
PYTHON_PORT=8000
NODE_SERVER_URL=http://localhost:4000
CONFIDENCE_THRESHOLD=0.5
```

| Variable | Description |
|----------|-------------|
| `AUTO_DISCOVER_CAMERAS` | When `true`, start a detection stream for every webcam found at startup |
| `FUSION_MODE` | `OR` (default) = any camera detecting drives the signal; `AND` = all cameras must detect |
| `CAMERA_INDEXES` | Explicit camera list, e.g. `0,2` — overrides auto-discovery |
| `CAMERA_INDEX` | Fallback webcam index when nothing is discovered |

### YOLO service URLs quick reference

| Key | Value |
|-----|-------|
| Health check | `http://localhost:8000/health` |
| MJPEG stream (primary) | `http://localhost:8000/video` |
| MJPEG stream (per camera) | `http://localhost:8000/video/{index}` |
| Camera list / switch | `http://localhost:8000/cameras` / `POST /cameras/select` |
| Backend POST target | `http://localhost:4000/api/yolo/detection` |

---

## Port map

| Service | Port | Env variable |
|---------|------|--------------|
| Frontend (Vite) | `5173` | (Vite default) |
| Backend (Express) | `4000` | `PORT` in `backend/.env` |
| Python YOLO (FastAPI) | `8000` | `PYTHON_PORT` in `yolo-service/.env` |

If you change the backend port, also update:

- `NODE_SERVER_URL` in `yolo-service/.env`
- `VITE_WS_URL` in `frontend/.env`
- `CORS_ORIGIN` in `backend/.env` (if frontend port changes)

---

## First-time setup checklist

1. Create `backend/.env` using the backend block above.
2. Create `frontend/.env` using the frontend block above.
3. Create `yolo-service/.env` using the YOLO block above.
4. Run database migrations:
   ```powershell
   cd backend
   npm run db:migrate
   npm run db:seed
   ```
5. Log in at http://localhost:5173 with:
   - **Email:** `admin@thesis.local`
   - **Password:** the `ADMIN_PASSWORD` value in `backend/.env`

---

## Security notes

- These credentials are for **development / thesis demo** use.
- Rotate JWT secrets and admin password before any production deployment.
- If the Aiven database password is rotated, update `DB_PASSWORD` (and `DATABASE_URL` if used) in `backend/.env` and in this file.
