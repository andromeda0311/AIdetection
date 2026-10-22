"""Read-only camera diagnostic.

Probes every capture index under each OpenCV backend and prints a matrix so you
can see which physical devices exist, which backend can see them, and what the
service would treat as a real camera.

    python _cameras.py
"""

import os
import sys

import cv2

from camera_utils import list_device_names, media_foundation_sees, open_capture

MAX_INDEX = int(os.getenv("MAX_CAMERA_INDEX", "4"))
BACKENDS = (
    ("DSHOW", cv2.CAP_DSHOW),
    ("MSMF", cv2.CAP_MSMF),
    ("ANY", None),
)


def probe(index: int, backend: int | None) -> tuple[bool, str]:
    capture = cv2.VideoCapture(index) if backend is None else cv2.VideoCapture(index, backend)
    try:
        if not capture.isOpened():
            return False, ""

        capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        success, frame = capture.read()
        if not success or frame is None:
            return True, "opened, no frame"

        height, width = frame.shape[:2]
        std = float(frame.std())
        return True, f"{width}x{height} std={std:.1f}"
    finally:
        capture.release()


def main() -> int:
    print("Media Foundation (WinRT) VideoCapture devices:")
    mf_devices = list_device_names(max_age=0.0)
    if mf_devices:
        for index, name in sorted(mf_devices.items()):
            print(f"  [{index}] {name}")
    else:
        print("  (unavailable)")

    print(f"\nOpenCV probe matrix (0..{MAX_INDEX - 1}):")
    header = f"{'idx':>3}  " + "  ".join(f"{name:<22}" for name, _ in BACKENDS)
    print(header)
    print("-" * len(header))

    for index in range(MAX_INDEX):
        cells = []
        for _name, backend in BACKENDS:
            try:
                ok, detail = probe(index, backend)
                cells.append(f"{'ok ' if ok else '-- '}{detail:<18}"[:22])
            except Exception as exc:
                cells.append(f"error {exc}"[:22])
        print(f"{index:>3}  " + "  ".join(f"{cell:<22}" for cell in cells))

    print("\nmedia_foundation_sees() membership oracle (what the service trusts):")
    for index in range(MAX_INDEX):
        print(f"  index {index}: real_camera={media_foundation_sees(index)}")

    print("\nopen_capture() backend preference check (what the service actually uses):")
    for index in range(MAX_INDEX):
        try:
            capture = open_capture(index)
            opened = capture.isOpened()
            backend = capture.getBackendName() if opened else "n/a"
            capture.release()
            print(f"  index {index}: opened={opened} backend={backend}")
        except Exception as exc:
            print(f"  index {index}: error {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
