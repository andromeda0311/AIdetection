import os
import sys
import tempfile
from dataclasses import dataclass

import cv2
import numpy as np

from detector import Detector


@dataclass
class ProcessedFrame:
    index: int
    content_type: str
    data: bytes
    pedestrian_count: int
    boxes: list[dict]


@dataclass
class VideoProcessResult:
    annotated_video: bytes
    annotated_content_type: str
    frames: list[ProcessedFrame]
    total_pedestrians: int
    meta: dict


def _boxes_from_detection(detections: list[dict]) -> list[dict]:
    return [
        {
            "x1": d["x1"],
            "y1": d["y1"],
            "x2": d["x2"],
            "y2": d["y2"],
            "confidence": d["confidence"],
            "className": d["class"],
        }
        for d in detections
    ]


def _open_video_writer(output_path: str, fps: float, size: tuple[int, int]) -> cv2.VideoWriter:
    """Pick a codec that works on this machine (mp4v first on Windows — no OpenH264 needed)."""
    width, height = size
    codecs = ("mp4v", "XVID", "avc1", "H264") if sys.platform == "win32" else ("avc1", "H264", "mp4v")
    for codec in codecs:
        fourcc = cv2.VideoWriter_fourcc(*codec)
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if writer.isOpened():
            return writer
        writer.release()
    raise RuntimeError("Unable to open video writer for annotated output.")


def process_video_file(
    input_path: str,
    detector: Detector,
    *,
    sample_every_n_frames: int = 30,
    max_frames_to_sample: int = 12,
) -> VideoProcessResult:
    capture = cv2.VideoCapture(input_path)
    if not capture.isOpened():
        raise RuntimeError(f"Unable to open video: {input_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    sample_every = max(1, sample_every_n_frames)

    temp_output = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    temp_output.close()
    output_path = temp_output.name

    writer = _open_video_writer(output_path, fps, (width, height))
    sampled_frames: list[ProcessedFrame] = []
    frame_index = 0
    peak_pedestrians = 0
    frames_read = 0

    try:
        while True:
            success, frame = capture.read()
            if not success:
                break

            frames_read += 1
            annotated, detection_data = detector.infer(frame)
            if annotated.dtype != np.uint8:
                annotated = annotated.astype(np.uint8)
            if not annotated.flags['C_CONTIGUOUS']:
                annotated = np.ascontiguousarray(annotated)
            if annotated.shape[1] != width or annotated.shape[0] != height:
                annotated = cv2.resize(annotated, (width, height))
            writer.write(annotated)

            count = detection_data["count"]
            peak_pedestrians = max(peak_pedestrians, count)

            if frame_index % sample_every == 0 and len(sampled_frames) < max_frames_to_sample:
                encoded, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if encoded:
                    sampled_frames.append(
                        ProcessedFrame(
                            index=len(sampled_frames),
                            content_type="image/jpeg",
                            data=buffer.tobytes(),
                            pedestrian_count=count,
                            boxes=_boxes_from_detection(detection_data["detections"]),
                        )
                    )

            frame_index += 1
    finally:
        capture.release()
        writer.release()

    with open(output_path, "rb") as annotated_file:
        annotated_bytes = annotated_file.read()
    os.remove(output_path)

    if not annotated_bytes:
        raise RuntimeError("Annotated video output was empty.")

    return VideoProcessResult(
        annotated_video=annotated_bytes,
        annotated_content_type="video/mp4",
        frames=sampled_frames,
        total_pedestrians=peak_pedestrians,
        meta={
            "model": os.getenv("YOLO_MODEL", "models/best.pt"),
            "api": "yolo-service",
            "framesRead": frames_read,
            "sampledFrames": len(sampled_frames),
        },
    )
