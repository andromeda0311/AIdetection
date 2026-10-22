import os
import time

SYNC_TOLERANCE_MS = float(os.getenv("SYNC_TOLERANCE_MS", "1000"))
FUSION_MODE = os.getenv("FUSION_MODE", "OR").strip().upper()
if FUSION_MODE not in ("AND", "OR"):
    FUSION_MODE = "OR"


class DetectionFusion:
    """
    Fuses per-camera live detections into one payload that drives the signal.

    - OR mode (default): any online camera detecting a pedestrian drives the signal
    - AND mode: every online camera must detect a pedestrian simultaneously
    - OR-fallback: when only one camera is online, that camera drives the signal
    - degraded: fewer cameras are online than configured
    """

    def __init__(self, expected_indexes: list[int]):
        self.expected_indexes = list(expected_indexes)
        self._latest: dict[int, dict | None] = {index: None for index in self.expected_indexes}

    def update(self, camera_index: int, detection: dict | None) -> None:
        if camera_index in self._latest:
            self._latest[camera_index] = detection

    def _camera_view(self, index: int, now_ms: float) -> dict:
        detection = self._latest.get(index)
        fresh = (
            detection is not None
            and (now_ms - float(detection.get("timestamp", 0))) <= SYNC_TOLERANCE_MS
        )
        return {
            "index": index,
            "online": fresh,
            "detected": bool(fresh and detection["detected"]),
            "count": detection["count"] if fresh else 0,
            "detections": detection["detections"] if fresh else [],
            "frameWidth": detection["frameWidth"] if fresh else 0,
            "frameHeight": detection["frameHeight"] if fresh else 0,
        }

    def fuse(self) -> dict:
        now_ms = time.time() * 1000
        cameras = [self._camera_view(index, now_ms) for index in self.expected_indexes]
        online = [cam for cam in cameras if cam["online"]]

        degraded = 0 < len(online) < len(self.expected_indexes)

        if len(online) > 1:
            if FUSION_MODE == "AND":
                detected = all(cam["detected"] for cam in online)
                mode = "AND"
            else:
                detected = any(cam["detected"] for cam in online)
                mode = "OR"
        elif len(online) == 1:
            detected = online[0]["detected"]
            mode = "OR_FALLBACK"
        else:
            detected = False
            mode = "OR_FALLBACK"

        if detected:
            if mode == "AND":
                count = sum(cam["count"] for cam in online)
            else:
                count = sum(cam["count"] for cam in online if cam["detected"])
        else:
            count = 0

        def best_confidence(cam: dict) -> float:
            return cam["detections"][0]["confidence"] if cam["detections"] else 0.0

        contributing = online if mode == "AND" else [cam for cam in online if cam["detected"]]
        best = max(contributing, key=best_confidence, default=None)

        return {
            "timestamp": int(now_ms),
            "detected": detected,
            "count": count,
            "fusionMode": mode,
            "degraded": degraded,
            "detections": best["detections"] if best else [],
            "frameWidth": best["frameWidth"] if best else 0,
            "frameHeight": best["frameHeight"] if best else 0,
            "cameras": cameras,
        }
