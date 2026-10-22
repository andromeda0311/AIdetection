# YOLO Live Detection Service

Python FastAPI service for real-time pedestrian detection from a webcam.

## Setup

```powershell
cd yolo-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy the trained model to `models/best.pt` (already copied from `yolobackend/best.pt`).

## Validate model (optional)

```powershell
python _validate.py
```

Press `q` to quit the OpenCV window.

## Run

```powershell
python app.py
```

- Health: http://localhost:8000/health
- MJPEG stream: http://localhost:8000/video

Detection JSON is POSTed to the Node backend at `NODE_SERVER_URL/api/yolo/detection` (default `http://localhost:4000`).

## Environment (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| YOLO_MODEL | models/best.pt | Path to weights |
| CAMERA_INDEX | 0 | Webcam index |
| PYTHON_PORT | 8000 | FastAPI port |
| NODE_SERVER_URL | http://localhost:4000 | Backend URL |
| CONFIDENCE_THRESHOLD | 0.5 | Min detection confidence |
