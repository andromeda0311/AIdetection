import os
import threading
import time
from contextlib import suppress

import cv2

from camera_utils import _configure_capture, open_capture, read_test_frame
from detector import Detector

STREAM_WIDTH = int(os.getenv("STREAM_WIDTH", "480"))
STREAM_HEIGHT = int(os.getenv("STREAM_HEIGHT", "360"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "45"))


class CameraStream:
    """
    Three-thread pipeline for low-latency live view:

    1. Capture — read the newest camera frame as fast as possible
    2. Inference — run YOLO on its own schedule
    3. Display — draw last-known boxes on the latest frame and encode MJPEG
    """

    def __init__(
        self,
        camera_index: int,
        detector: Detector,
        *,
        inference_interval: float = 0.12,
        stream_fps: float = 25.0,
        capture_buffer_size: int = 1,
    ):
        self.camera_index = camera_index
        self.detector = detector
        self.inference_interval = max(0.05, inference_interval)
        self.stream_interval = 1.0 / max(1.0, stream_fps)
        self.capture_buffer_size = capture_buffer_size

        self.capture = self._open_camera(camera_index)

        self.latest_jpeg: bytes | None = None
        self.latest_detection: dict | None = None
        self.running = True

        self._frame_lock = threading.Lock()
        self._switch_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._latest_frame = None
        self._latest_detections: list[dict] = []
        self._grab_failures = 0

        self._capture_thread = threading.Thread(target=self._capture_loop, daemon=True, name="capture")
        self._inference_thread = threading.Thread(target=self._inference_loop, daemon=True, name="inference")
        self._display_thread = threading.Thread(target=self._display_loop, daemon=True, name="display")

    def _open_camera(self, camera_index: int):
        capture = open_capture(camera_index)
        if not capture.isOpened():
            raise RuntimeError(f"Camera index {camera_index} failed to open")
        capture.set(cv2.CAP_PROP_BUFFERSIZE, self.capture_buffer_size)
        _configure_capture(capture)
        success, _size = read_test_frame(capture)
        if not success:
            capture.release()
            raise RuntimeError(
                f"Camera index {camera_index} opened but could not read a frame. "
                "Close other apps using the webcam and try again."
            )
        return capture

    def get_camera_index(self) -> int:
        return self.camera_index

    def switch_camera(self, camera_index: int) -> None:
        with self._switch_lock:
            if camera_index == self.camera_index and self.capture.isOpened():
                success, _size = read_test_frame(self.capture)
                if success:
                    return

            old_capture = self.capture
            self.capture = None

            with suppress(Exception):
                if old_capture is not None and old_capture.isOpened():
                    old_capture.release()

            # Windows drivers need a moment before the same USB device can reopen.
            time.sleep(0.25)

            new_capture = self._open_camera(camera_index)

            with self._frame_lock:
                self.capture = new_capture
                self.camera_index = camera_index
                self._latest_frame = None
                self._grab_failures = 0

            with self._state_lock:
                self._latest_detections = []
                self.latest_detection = None
                self.latest_jpeg = None

    def start(self) -> None:
        self._capture_thread.start()
        self._inference_thread.start()
        self._display_thread.start()

    def _read_frame(self):
        capture = self.capture
        if capture is None or not capture.isOpened():
            return False, None

        success, frame = capture.read()
        if success and frame is not None:
            self._grab_failures = 0
            return True, frame

        self._grab_failures += 1
        return False, None

    def _capture_loop(self) -> None:
        while self.running:
            with self._switch_lock:
                success, frame = self._read_frame()

            if not success or frame is None:
                if self._grab_failures >= 30:
                    self._try_recover_capture()
                time.sleep(0.02)
                continue

            with self._frame_lock:
                self._latest_frame = frame

    def _try_recover_capture(self) -> None:
        with self._switch_lock:
            if self.capture is None:
                return
            index = self.camera_index
            with suppress(Exception):
                if self.capture.isOpened():
                    self.capture.release()
            time.sleep(0.25)
            try:
                self.capture = self._open_camera(index)
                self._grab_failures = 0
            except RuntimeError:
                time.sleep(0.5)

    def _copy_latest_frame(self):
        with self._frame_lock:
            if self._latest_frame is None:
                return None
            return self._latest_frame.copy()

    def _inference_loop(self) -> None:
        while self.running:
            loop_started = time.perf_counter()
            frame = self._copy_latest_frame()
            if frame is not None:
                detections, meta = self.detector.detect(frame)
                with self._state_lock:
                    self._latest_detections = detections
                    self.latest_detection = meta

            elapsed = time.perf_counter() - loop_started
            time.sleep(max(0.0, self.inference_interval - elapsed))

    def _display_loop(self) -> None:
        while self.running:
            loop_started = time.perf_counter()
            with self._frame_lock:
                frame = None if self._latest_frame is None else self._latest_frame

            if frame is not None:
                with self._state_lock:
                    detections = list(self._latest_detections)

                output = self.detector.annotate(frame, detections)
                if output.shape[1] != STREAM_WIDTH or output.shape[0] != STREAM_HEIGHT:
                    output = cv2.resize(
                        output,
                        (STREAM_WIDTH, STREAM_HEIGHT),
                        interpolation=cv2.INTER_AREA,
                    )

                success, buffer = cv2.imencode(
                    ".jpg",
                    output,
                    [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY],
                )
                if success:
                    with self._state_lock:
                        self.latest_jpeg = buffer.tobytes()

            elapsed = time.perf_counter() - loop_started
            time.sleep(max(0.0, self.stream_interval - elapsed))

    def get_jpeg(self) -> bytes | None:
        with self._state_lock:
            return self.latest_jpeg

    def get_detection(self) -> dict | None:
        with self._state_lock:
            return self.latest_detection.copy() if self.latest_detection else None

    def stop(self) -> None:
        self.running = False
        for thread in (self._capture_thread, self._inference_thread, self._display_thread):
            if thread.is_alive():
                thread.join(timeout=1.0)
        with suppress(Exception):
            if self.capture is not None and self.capture.isOpened():
                self.capture.release()
