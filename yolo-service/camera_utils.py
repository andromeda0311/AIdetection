import os
import subprocess
import sys
import time

import cv2

CAMERA_WIDTH = int(os.getenv("CAMERA_WIDTH", "640"))
CAMERA_HEIGHT = int(os.getenv("CAMERA_HEIGHT", "480"))

# Optional second net: reject cameras whose frames are essentially flat.
# Disabled by default because a real camera in a dark room is also nearly flat.
MIN_FRAME_STD = float(os.getenv("MIN_FRAME_STD", "0.0"))

# Optional allowlist of device-name substrings, e.g. "HP Wide Vision,XJS".
# Empty means "every device that passes the membership check".
CAMERA_NAME_PATTERN = tuple(
    part.strip().lower()
    for part in os.getenv("CAMERA_NAME_PATTERN", "").split(",")
    if part.strip()
)

# When true, accept anything that opens, including software/virtual cameras
# ("Windows Virtual Camera Device", OBS Virtual Camera).
CAMERA_ALLOW_VIRTUAL = os.getenv("CAMERA_ALLOW_VIRTUAL", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

DEVICE_NAME_CACHE_SEC = float(os.getenv("CAMERA_LIST_CACHE_SEC", "30"))

# Windows drivers need a moment after a release before the same USB device
# can be reopened with a different backend.
REOPEN_DELAY_SEC = 0.25

# DirectShow enumerates the raw PnP device stack, so it also exposes software
# cameras such as "Windows Virtual Camera Device" as extra indexes. Media
# Foundation only enumerates physical capture devices, so it is the reliable
# oracle for "does a real camera exist at this index?".
MEMBERSHIP_BACKEND = cv2.CAP_MSMF if sys.platform == "win32" else None

_POWERSHELL_CANDIDATE = os.path.join(
    os.environ.get("WINDIR", r"C:\Windows"),
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
)
POWERSHELL = (
    _POWERSHELL_CANDIDATE if os.path.exists(_POWERSHELL_CANDIDATE) else "powershell"
)

_DEVICE_NAMES_SCRIPT = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceClass, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$method = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
$op = [Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync(
    [Windows.Devices.Enumeration.DeviceClass]::VideoCapture)
$task = $method.MakeGenericMethod(
    [Windows.Devices.Enumeration.DeviceInformationCollection]).Invoke($null, @($op))
$task.Wait(-1) | Out-Null
$index = 0
foreach ($device in $task.Result) {
    Write-Output ("[{0}] {1}" -f $index, $device.Name)
    $index++
}
"""


class suppress_opencv_logs:
    def __enter__(self):
        try:
            self._prev = cv2.getLogLevel()
            cv2.setLogLevel(cv2.LOG_LEVEL_ERROR)
        except AttributeError:
            self._prev = None
        return self

    def __exit__(self, *_args):
        if self._prev is not None:
            cv2.setLogLevel(self._prev)


_device_names_cache: dict[int, str] = {}
_device_names_cached_at = 0.0


def _enumerate_media_foundation_devices() -> dict[int, str]:
    if sys.platform != "win32":
        return {}

    try:
        completed = subprocess.run(
            [POWERSHELL, "-NoProfile", "-NonInteractive", "-Command", _DEVICE_NAMES_SCRIPT],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return {}

    if completed.returncode != 0:
        return {}

    devices: dict[int, str] = {}
    for line in completed.stdout.splitlines():
        line = line.strip()
        if not line.startswith("["):
            continue
        index_text, separator, name = line[1:].partition("]")
        if not separator:
            continue
        try:
            devices[int(index_text.strip())] = name.strip()
        except ValueError:
            continue

    return devices


def list_device_names(*, max_age: float | None = None) -> dict[int, str]:
    """
    Map index -> real device name using Media Foundation enumeration.

    Media Foundation is used rather than DirectShow because DirectShow also
    lists software cameras, which would hide the difference between a real
    webcam and a virtual one. Returns an empty mapping when unavailable, in
    which case callers fall back to index-only probing.
    """
    global _device_names_cached_at

    max_age = DEVICE_NAME_CACHE_SEC if max_age is None else max_age
    now = time.monotonic()
    if _device_names_cached_at and now - _device_names_cached_at < max_age:
        return dict(_device_names_cache)

    devices = _enumerate_media_foundation_devices()
    _device_names_cache.clear()
    _device_names_cache.update(devices)
    _device_names_cached_at = now
    return dict(devices)


def media_foundation_sees(camera_index: int) -> bool:
    """True when Media Foundation reports a physical camera at this index."""
    if MEMBERSHIP_BACKEND is None:
        return True

    with suppress_opencv_logs():
        capture = cv2.VideoCapture(camera_index, MEMBERSHIP_BACKEND)
        try:
            if not capture.isOpened():
                return False
            success, frame = capture.read()
            return bool(success and frame is not None)
        except cv2.error:
            return False
        finally:
            capture.release()


def _configure_capture(capture, *, capture_buffer_size: int = 1) -> None:
    capture.set(cv2.CAP_PROP_BUFFERSIZE, capture_buffer_size)
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    capture.set(cv2.CAP_PROP_FPS, 30)


def _try_open(camera_index: int, backend: int | None = None):
    if backend is None:
        return cv2.VideoCapture(camera_index)
    return cv2.VideoCapture(camera_index, backend)


def open_capture(camera_index: int):
    """
    Open a webcam on Windows, trying the most reliable backends first.
    DirectShow is tried before MSMF because MSMF often fails while another
    app already holds the same camera index.

    Membership (whether this index is a real camera at all) is decided
    separately by `media_foundation_sees`, so opening here stays permissive.
    """
    if sys.platform == "win32":
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, None]
    else:
        backends = [None]

    last_capture = None

    with suppress_opencv_logs():
        for backend in backends:
            capture = _try_open(camera_index, backend)
            last_capture = capture
            if not capture.isOpened():
                capture.release()
                continue

            _configure_capture(capture)
            success, _frame = capture.read()
            if success:
                return capture

            capture.release()

        if last_capture is not None and last_capture.isOpened():
            return last_capture

        return _try_open(camera_index)


def read_test_frame(capture) -> tuple[bool, tuple[int, int] | None]:
    success, frame = capture.read()
    if not success or frame is None:
        return False, None
    height, width = frame.shape[:2]
    return True, (width, height)


def _frame_std(frame) -> float:
    return float(frame.std())


def name_matches_pattern(name: str | None) -> bool:
    if not CAMERA_NAME_PATTERN:
        return True
    if not name:
        return True
    lowered = name.lower()
    return any(pattern in lowered for pattern in CAMERA_NAME_PATTERN)


def probe_camera(
    camera_index: int,
    *,
    capture_buffer_size: int = 1,
    name: str | None = None,
) -> dict | None:
    """
    Return a camera entry only when the index is a real, readable camera.

    The Media Foundation membership check is what removes software cameras such
    as "Windows Virtual Camera Device", which DirectShow happily opens but
    which are not physical webcams.
    """
    if not CAMERA_ALLOW_VIRTUAL:
        if not media_foundation_sees(camera_index):
            return None
        # The membership probe just released the device; give the Windows driver
        # time before reopening it with a different backend.
        time.sleep(REOPEN_DELAY_SEC)

    if not name_matches_pattern(name):
        return None

    with suppress_opencv_logs():
        capture = open_capture(camera_index)
        if not capture.isOpened():
            return None

        capture.set(cv2.CAP_PROP_BUFFERSIZE, capture_buffer_size)
        _configure_capture(capture)
        success, frame = capture.read()
        capture.release()

        if not success or frame is None:
            return None

        if MIN_FRAME_STD > 0 and _frame_std(frame) < MIN_FRAME_STD:
            return None

        height, width = frame.shape[:2]
        return camera_entry(camera_index, name, width, height)


def camera_entry(
    camera_index: int,
    name: str | None = None,
    width: int = CAMERA_WIDTH,
    height: int = CAMERA_HEIGHT,
) -> dict:
    label = name or f"Camera {camera_index}"
    return {
        "index": camera_index,
        "name": name,
        "label": f"{label} ({width}x{height})",
        "width": width,
        "height": height,
    }


def active_camera_entry(camera_index: int, *, name: str | None = None) -> dict:
    return camera_entry(camera_index, name, CAMERA_WIDTH, CAMERA_HEIGHT)


def list_available_cameras(
    max_index: int = 10,
    *,
    capture_buffer_size: int = 1,
    active_indexes: set[int] | None = None,
) -> list[dict]:
    """
    List webcams without fighting the live streams for active indexes.
    Cameras currently in use are always included and never re-probed.
    """
    cameras: list[dict] = []
    seen: set[int] = set()
    misses = 0

    names = list_device_names()

    for index in sorted(active_indexes or set()):
        cameras.append(active_camera_entry(index, name=names.get(index)))
        seen.add(index)

    # When Media Foundation gave us a device list, it is authoritative about
    # how many physical cameras exist, so only probe those indexes.
    if names:
        candidates = sorted(index for index in names if index < max_index)
    else:
        candidates = list(range(max_index))

    with suppress_opencv_logs():
        for index in candidates:
            if index in seen:
                continue

            camera = probe_camera(
                index,
                capture_buffer_size=capture_buffer_size,
                name=names.get(index),
            )
            if camera is not None:
                cameras.append(camera)
                seen.add(index)
                misses = 0
            else:
                misses += 1
                if misses >= 2 and cameras:
                    break

    cameras.sort(key=lambda item: item["index"])
    return cameras


def verify_camera_index(camera_index: int, *, capture_buffer_size: int = 1) -> None:
    with suppress_opencv_logs():
        capture = open_capture(camera_index)
        try:
            if not capture.isOpened():
                raise RuntimeError(f"Camera index {camera_index} failed to open.")

            capture.set(cv2.CAP_PROP_BUFFERSIZE, capture_buffer_size)
            _configure_capture(capture)
            success, _size = read_test_frame(capture)
            if not success:
                raise RuntimeError(
                    f"Camera index {camera_index} opened but could not read a frame. "
                    "Close other apps using the webcam (Zoom, Teams, Camera app) and try again."
                )
        finally:
            capture.release()
