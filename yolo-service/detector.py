import os
import threading
import time

import cv2
import numpy as np
from ultralytics import YOLO

INFERENCE_SIZE = int(os.getenv("INFERENCE_SIZE", "320"))
BOX_COLOR = (0, 0, 255)  # BGR red
BOX_THICKNESS = 3
LABEL_BG = (0, 0, 255)
LABEL_TEXT = (255, 255, 255)


class Detector:
    def __init__(self, model_path: str, confidence_threshold: float = 0.5):
        self.model = YOLO(model_path)
        self.class_names = self.model.names
        self.confidence_threshold = confidence_threshold
        self._infer_lock = threading.Lock()

    def detect(self, frame: np.ndarray) -> tuple[list[dict], dict]:
        """Run YOLO on a smaller frame for speed, then map boxes back to full size."""
        height, width = frame.shape[:2]
        scale = 1.0
        infer_frame = frame

        if max(width, height) > INFERENCE_SIZE:
            scale = INFERENCE_SIZE / max(width, height)
            infer_frame = cv2.resize(
                frame,
                (max(1, int(width * scale)), max(1, int(height * scale))),
                interpolation=cv2.INTER_AREA,
            )

        with self._infer_lock:
            results = self.model(
                infer_frame,
                conf=self.confidence_threshold,
                verbose=False,
                imgsz=INFERENCE_SIZE,
            )
        detections = self._extract_detections(results, scale=scale)
        return detections, self._build_meta(frame, detections)

    def _extract_detections(self, results, scale: float = 1.0) -> list[dict]:
        detections: list[dict] = []
        boxes = results[0].boxes
        if boxes is None:
            return detections

        inv_scale = 1.0 / scale if scale > 0 else 1.0

        for box in boxes:
            confidence = float(box.conf[0])
            if confidence < self.confidence_threshold:
                continue
            cls_id = int(box.cls[0])
            x1, y1, x2, y2 = [float(v) * inv_scale for v in box.xyxy[0]]
            detections.append(
                {
                    "class": self.class_names[cls_id],
                    "confidence": round(confidence, 4),
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1),
                }
            )

        return detections
    def _build_meta(self, frame: np.ndarray, detections: list[dict]) -> dict:
        return {
            "timestamp": int(time.time() * 1000),
            "detected": len(detections) > 0,
            "count": len(detections),
            "detections": detections,
            "frameWidth": int(frame.shape[1]),
            "frameHeight": int(frame.shape[0]),
        }

    def _draw_boxes(self, frame: np.ndarray, detections: list[dict]) -> np.ndarray:
        if not detections:
            return frame

        output = frame.copy()
        height, width = output.shape[:2]

        for detection in detections:
            x1 = max(0, min(width - 1, int(detection["x1"])))
            y1 = max(0, min(height - 1, int(detection["y1"])))
            x2 = max(0, min(width - 1, int(detection["x2"])))
            y2 = max(0, min(height - 1, int(detection["y2"])))
            if x2 <= x1 or y2 <= y1:
                continue

            cv2.rectangle(output, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)

            label = f"{detection['class']} {detection['confidence']:.2f}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            thickness = 2
            (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            label_top = max(0, y1 - text_height - baseline - 8)
            label_bottom = label_top + text_height + baseline + 8
            cv2.rectangle(
                output,
                (x1, label_top),
                (min(width, x1 + text_width + 10), label_bottom),
                LABEL_BG,
                -1,
            )
            cv2.putText(
                output,
                label,
                (x1 + 5, label_bottom - baseline - 2),
                font,
                font_scale,
                LABEL_TEXT,
                thickness,
                cv2.LINE_AA,
            )

        return output

    def annotate(self, frame: np.ndarray, detections: list[dict]) -> np.ndarray:
        """Fast overlay — no model inference."""
        return self._draw_boxes(frame, detections)

    def infer(self, frame: np.ndarray):
        """Full pipeline for offline video processing."""
        detections, meta = self.detect(frame)
        return self.annotate(frame, detections), meta
