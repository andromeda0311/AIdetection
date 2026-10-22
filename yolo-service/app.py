import asyncio
import base64
import os
import sys
import tempfile
import time
from contextlib import asynccontextmanager, suppress

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from detector import Detector
from camera import CameraStream
from camera_utils import list_available_cameras
from fusion import DetectionFusion
from video_processor import process_video_file

load_dotenv()

MODEL_PATH = os.getenv("YOLO_MODEL", "models/best.pt")
CAMERA_INDEXES_RAW = os.getenv("CAMERA_INDEXES", "").strip()
CAMERA_INDEXES = [
    int(part)
    for part in CAMERA_INDEXES_RAW.split(",")
    if part != ""
]
AUTO_DISCOVER_CAMERAS = os.getenv("AUTO_DISCOVER_CAMERAS", "true").strip().lower() in (
    "1", "true", "yes", "on"
)
PORT = int(os.getenv("PYTHON_PORT", "8000"))
NODE_SERVER_URL = os.getenv("NODE_SERVER_URL", "http://localhost:4000")
# Must match the backend's YOLO_INGEST_KEY when that is set.
YOLO_INGEST_KEY = os.getenv("YOLO_INGEST_KEY", "")
INGEST_HEADERS = {"X-Ingest-Key": YOLO_INGEST_KEY} if YOLO_INGEST_KEY else {}
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
INFERENCE_INTERVAL = float(os.getenv("INFERENCE_INTERVAL", "0.12"))
STREAM_FPS = float(os.getenv("STREAM_FPS", "25"))
POST_INTERVAL = float(os.getenv("POST_INTERVAL", "0.5"))
CAPTURE_BUFFER_SIZE = int(os.getenv("CAPTURE_BUFFER_SIZE", "1"))
MAX_CAMERA_INDEX = int(os.getenv("MAX_CAMERA_INDEX", "4"))
CAMERA_LIST_CACHE_SEC = float(os.getenv("CAMERA_LIST_CACHE_SEC", "30"))

_camera_list_cache: dict[str, object] = {"at": 0.0, "cameras": []}


def get_cached_cameras(*, force: bool = False) -> list[dict]:
    now = time.time()
    cached_at = float(_camera_list_cache["at"])
    if not force and now - cached_at < CAMERA_LIST_CACHE_SEC:
        return list(_camera_list_cache["cameras"])  # type: ignore[arg-type]

    active_indexes = {stream.get_camera_index() for stream in camera_streams}
    cameras = list_available_cameras(
        MAX_CAMERA_INDEX,
        capture_buffer_size=CAPTURE_BUFFER_SIZE,
        active_indexes=active_indexes,
    )
    _camera_list_cache["at"] = now
    _camera_list_cache["cameras"] = cameras
    return cameras


detector = Detector(MODEL_PATH, CONFIDENCE_THRESHOLD)


def _resolve_camera_indexes() -> list[int]:
    if CAMERA_INDEXES_RAW:
        print(
            f"[camera] using pinned CAMERA_INDEXES={CAMERA_INDEXES}",
            file=sys.stderr,
        )
        return CAMERA_INDEXES
    if AUTO_DISCOVER_CAMERAS:
        discovered = list_available_cameras(
            MAX_CAMERA_INDEX,
            capture_buffer_size=CAPTURE_BUFFER_SIZE,
        )
        indexes = [int(cam["index"]) for cam in discovered]
        if indexes:
            for cam in discovered:
                print(
                    f"[camera] discovered index {cam['index']}: "
                    f"{cam.get('name') or 'unnamed device'} ({cam['width']}x{cam['height']})",
                    file=sys.stderr,
                )
            print(f"[camera] auto-discovered cameras: {indexes}", file=sys.stderr)
            return indexes
        print(
            "[camera] no cameras auto-discovered; falling back to CAMERA_INDEX",
            file=sys.stderr,
        )
    return CAMERA_INDEXES or [int(os.getenv("CAMERA_INDEX", "0"))]


def _build_camera_streams() -> list[CameraStream]:
    streams: list[CameraStream] = []
    last_error: RuntimeError | None = None
    for index in _resolve_camera_indexes():
        try:
            streams.append(
                CameraStream(
                    index,
                    detector,
                    inference_interval=INFERENCE_INTERVAL,
                    stream_fps=STREAM_FPS,
                    capture_buffer_size=CAPTURE_BUFFER_SIZE,
                )
            )
        except RuntimeError as exc:
            print(f"[camera] index {index} unavailable: {exc}", file=sys.stderr)
            last_error = exc
    if not streams:
        raise last_error or RuntimeError("No cameras configured")
    return streams


camera_streams = _build_camera_streams()
fusion = DetectionFusion([stream.get_camera_index() for stream in camera_streams])

_publish_task: asyncio.Task | None = None


def _fused_signature(fused: dict) -> tuple:
    return (
        fused["detected"],
        fused["count"],
        fused["degraded"],
        fused["fusionMode"],
        tuple(
            (
                cam["index"],
                cam["online"],
                tuple(
                    (d["class"], d["confidence"], d["x1"], d["y1"], d["x2"], d["y2"])
                    for d in cam["detections"]
                ),
            )
            for cam in fused["cameras"]
        ),
    )


async def publish_detections_loop() -> None:
    last_signature: tuple | None = None
    last_post_at = 0.0
    last_publish_error_log = 0.0

    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            while any(stream.running for stream in camera_streams):
                for stream in camera_streams:
                    fusion.update(stream.get_camera_index(), stream.get_detection())

                fused = fusion.fuse()
                now = asyncio.get_running_loop().time()
                state_changed = (
                    last_signature is None
                    or _fused_signature(fused) != last_signature
                )
                heartbeat_due = (now - last_post_at) >= POST_INTERVAL

                if state_changed or heartbeat_due:
                    try:
                        await client.post(
                            f"{NODE_SERVER_URL}/api/yolo/detection",
                            json=fused,
                            headers=INGEST_HEADERS,
                        )
                        last_signature = _fused_signature(fused)
                        last_post_at = now
                    except httpx.HTTPError as exc:
                        if now - last_publish_error_log >= 5.0:
                            print(
                                f"[publish] POST to {NODE_SERVER_URL}/api/yolo/detection failed: {exc}",
                                file=sys.stderr,
                            )
                            last_publish_error_log = now

                try:
                    await asyncio.sleep(0.1)
                except asyncio.CancelledError:
                    break
    except asyncio.CancelledError:
        return


async def _shutdown() -> None:
    """Stop camera threads and background tasks without noisy tracebacks."""
    global _publish_task

    for stream in camera_streams:
        stream.stop()

    if _publish_task is not None and not _publish_task.done():
        _publish_task.cancel()
        with suppress(asyncio.CancelledError):
            await _publish_task

    _publish_task = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _publish_task

    for stream in camera_streams:
        stream.start()
    _publish_task = asyncio.create_task(publish_detections_loop())

    try:
        yield
    finally:
        await _shutdown()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "online",
        "model": MODEL_PATH,
        "camera_indexes": [stream.get_camera_index() for stream in camera_streams],
    }


@app.get("/cameras")
async def cameras():
    listed = await asyncio.to_thread(
        get_cached_cameras,
        force=False,
    )
    return {
        "indexes": [stream.get_camera_index() for stream in camera_streams],
        "cameras": listed,
    }


class CameraSelectRequest(BaseModel):
    index: int


@app.post("/cameras/select")
async def select_camera(request: CameraSelectRequest):
    index = request.index
    if any(
        stream.get_camera_index() == index
        for stream in camera_streams[1:]
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Camera index {index} is already used by another active stream.",
        )

    primary = camera_streams[0]
    try:
        await asyncio.to_thread(primary.switch_camera, index)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _camera_list_cache["at"] = 0.0
    return {"index": primary.get_camera_index()}


def _get_stream(index: int) -> CameraStream:
    for stream in camera_streams:
        if stream.get_camera_index() == index:
            return stream
    raise HTTPException(status_code=404, detail=f"Camera index {index} is not active.")


async def mjpeg_stream(request: Request, stream: CameraStream):
    """Send the freshest JPEG as soon as it is available."""
    poll_interval = 1.0 / max(15.0, STREAM_FPS)

    try:
        while stream.running:
            if await request.is_disconnected():
                break

            frame = stream.get_jpeg()
            if frame is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )

            try:
                await asyncio.sleep(poll_interval)
            except asyncio.CancelledError:
                break
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError):
        pass


@app.get("/video")
async def video(request: Request):
    return StreamingResponse(
        mjpeg_stream(request, camera_streams[0]),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/video/{index}")
async def video_by_index(index: int, request: Request):
    stream = _get_stream(index)
    return StreamingResponse(
        mjpeg_stream(request, stream),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/detect/video")
async def detect_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Video file is required.")

    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_path = temp_file.name
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        result = await asyncio.to_thread(process_video_file, temp_path, detector)

        return {
            "totalPedestrians": result.total_pedestrians,
            "meta": result.meta,
            "annotatedVideo": {
                "contentType": result.annotated_content_type,
                "base64": base64.b64encode(result.annotated_video).decode("ascii"),
                "pedestrianCount": result.total_pedestrians,
            },
            "frames": [
                {
                    "index": frame.index,
                    "contentType": frame.content_type,
                    "base64": base64.b64encode(frame.data).decode("ascii"),
                    "pedestrianCount": frame.pedestrian_count,
                    "boxes": frame.boxes,
                }
                for frame in result.frames
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video detection failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        lifespan="on",
    )
