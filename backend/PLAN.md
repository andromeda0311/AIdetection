# Backend Plan — Video Upload → Pedestrian Detection → Arduino Traffic Light

Status: implemented (mock detection client active until the real YOLOv11 API is provided)

## Goal

The backend stores pedestrian-detection videos uploaded by staff, forwards each video to a
YOLOv11 detection API, stores the returned detected frames and metadata, and drives an
Arduino Uno traffic light over USB serial when a pedestrian is detected.

## End-to-end flow

1. **Upload** — `POST /api/detections/upload` (multipart, field `file`, authenticated staff).
   - Validated by extension (multer) and by magic bytes (`file-type`).
   - Raw video saved to `<UPLOAD_DIR>/uploads/<uuid>.<ext>` (in Docker this is the `files_data`
     volume at `/app/storage`).
   - Responds `202 { detection: { id, status: "processing" } }`.
2. **Process** — an in-process async job streams the video to the detection client.
   - **Mock client** now: returns the original video as a single "frame" plus simulated
     metadata (`DETECTION_MOCK_PEDESTRIANS`, default `1`).
   - **Real client later**: `DETECTION_API_URL` + key; only the client file changes.
   - Detected frames saved to `<UPLOAD_DIR>/detections/<detectionId>/frame_XXXX.<ext>`.
   - Rows written to `detections` and `detection_frames`; status → `completed` / `failed`.
3. **Signal** — on completion with `pedestrian_detected = true`, the `TrafficSignalMachine` runs:
   - **GREEN** (default) → **YELLOW** (`SIGNAL_YELLOW_MS`, 3s) → **RED**
     (`SIGNAL_RED_MS`, 20s), holding RED while new pedestrian detections keep arriving,
     then back to **GREEN**.
   - Each transition is sent to the signal controller (`log` / `serial` / `http`) and logged
     to `signal_events`.
4. **Retrieve** — the frontend polls `GET /api/detections/:id` and downloads the original
   video or any detected frame via authenticated routes.

## Database tables (added to `schema.sql`, idempotent)

- `detections` — id, staff_user_id FK, input file path/name/type/size, status
  (`processing|completed|failed`), `pedestrian_detected`, `total_pedestrians`,
  `detection_meta JSONB`, `error_message`, timestamps.
- `detection_frames` — id, detection_id FK, `frame_index`, file_path, content_type,
  `pedestrian_count`, `boxes JSONB`.
- `signal_events` — id, state, detection_id, triggered_by (`auto|admin`), created_at.

## New env vars

```
UPLOAD_DIR                     # ./storage locally, /app/storage in Docker
UPLOAD_MAX_FILE_SIZE_MB        # 200 (video)
UPLOAD_MAX_FILES_PER_REQUEST   # 1
UPLOAD_ALLOWED_EXTENSIONS      # mp4,mov,avi,mkv,webm,m4v
UPLOAD_ALLOWED_MIME_TYPES      # video/*
DETECTION_MOCK                 # true until the real YOLO API exists
DETECTION_API_URL / DETECTION_API_KEY / DETECTION_API_TIMEOUT_MS
DETECTION_MOCK_PEDESTRIANS     # simulate 0 or 1+ pedestrians for testing
SIGNAL_TRANSPORT               # log | serial | http
SIGNAL_SERIAL_PORT / SIGNAL_BAUD
SIGNAL_YELLOW_MS / SIGNAL_RED_MS / SIGNAL_CLEAR_GRACE_MS
SIGNAL_ARDUINO_URL             # for the http transport
```

## API

| Method | Endpoint | Access | Purpose |
| ------ | -------- | ------ | ------- |
| POST   | `/api/detections/upload` | staff | Upload video, start async detection |
| GET    | `/api/detections` | staff | List detections (page/limit) |
| GET    | `/api/detections/:id` | staff | Detail incl. frames |
| GET    | `/api/detections/:id/input/file` | staff | Download original video |
| GET    | `/api/detections/:id/frames/:frameId/file` | staff | Download a detected frame |
| GET    | `/api/signal/status` | staff | Current light state |
| GET    | `/api/signal/events` | staff | Signal audit log |
| POST   | `/api/signal/red\|yellow\|green` | admin | Manual override |

## Arduino (USB serial)

- `serialport` transport writes `GREEN\n` / `YELLOW\n` / `RED\n` lines.
- Firmware: `arduino/traffic_light.ino` reads the serial line and drives 3 LEDs
  (default pins 9/10/11).
- The backend must run **on the host PC** for serial to work (Docker on Windows cannot
  reach COM ports). Without hardware, use `SIGNAL_TRANSPORT=log` — every transition is
  still recorded in `signal_events`.

## Security

- All routes require an access token; manual signal overrides require `admin`.
- Files validated by magic bytes (not just extension), server-generated filenames,
  size caps, `storage/` gitignored.
- File downloads resolve paths inside `UPLOAD_DIR` only (traversal-safe) and set the
  correct `Content-Type`.

## Swapping in the real YOLO API

1. Implement `DetectionClient.detectVideo()` (see `src/services/detection.client.ts`).
2. Point the client at `DETECTION_API_URL`; set `DETECTION_MOCK=false`.
3. Normalize the API response into `DetectionApiResult { frames, totalPedestrians, meta }`.
   No other code changes.
