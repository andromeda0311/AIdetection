import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { createPersonDetector, type PersonBox, type PersonDetector } from '@/utils/personDetector';

export type WebcamStatus = 'idle' | 'requesting' | 'loading' | 'monitoring' | 'paused' | 'error';

export interface WebcamDevice {
  deviceId: string;
  label: string;
}

export interface WebcamDetectionOptions {
  /** Minimum detector confidence for a person (0..1). */
  minScore?: number;
  /** Target time between detection passes; ~150 ms is about 6-7 per second. */
  intervalMs?: number;
  /** A feed whose frames stop advancing for this long is treated as stalled. */
  stallMs?: number;
}

const DEVICE_STORAGE_KEY = 'webcam-detection-device';

// One detector per page: loading the model is the slow part, so it is shared
// across mounts and retried only after a failure.
let detectorPromise: Promise<PersonDetector> | null = null;
let detectorScore = 0;
function loadDetector(minScore: number): Promise<PersonDetector> {
  if (!detectorPromise || detectorScore !== minScore) {
    detectorScore = minScore;
    detectorPromise = createPersonDetector(minScore).catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/** Turns getUserMedia failures into messages an operator can act on. */
export function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access in the browser address bar, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'The selected camera was not found. Check that the webcam is plugged in, or choose another camera.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is in use by another application or could not be started. Close other apps using it, then try again.';
    default:
      return err instanceof Error && err.message ? `Camera error: ${err.message}` : 'The camera could not be started.';
  }
}

function readStoredDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeDevice(deviceId: string): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  } catch {
    /* Remember the camera for this session only. */
  }
}

/**
 * Opens a webcam in the browser and counts visible people with an on-device model.
 * The count is null whenever detection is not actually running, so "no data" is
 * never shown as zero people.
 */
export function useWebcamDetection(options: WebcamDetectionOptions = {}) {
  const minScore = options.minScore ?? 0.5;
  const intervalMs = options.intervalMs ?? 150;
  const stallMs = options.stallMs ?? 3000;

  const status = ref<WebcamStatus>('idle');
  const error = ref<string | null>(null);
  const devices = ref<WebcamDevice[]>([]);
  const deviceId = ref<string | null>(readStoredDevice());
  const boxes = shallowRef<PersonBox[]>([]);
  const frameSize = ref({ width: 0, height: 0 });
  const lastDetectionAt = ref(0);
  const detectionsPerSecond = ref(0);
  const delegate = ref<'GPU' | 'CPU' | null>(null);

  const active = computed(() => status.value === 'monitoring' || status.value === 'paused' || status.value === 'loading' || status.value === 'requesting');
  const count = computed<number | null>(() => (status.value === 'monitoring' && lastDetectionAt.value > 0 ? boxes.value.length : null));

  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;
  let detector: PersonDetector | null = null;
  let loopTimer: ReturnType<typeof setTimeout> | null = null;
  let runId = 0;
  let lastVideoTime = -1;
  let lastVideoAdvanceAt = 0;
  let rateWindowStart = 0;
  let rateWindowCount = 0;

  function clearDetections(): void {
    boxes.value = [];
    lastDetectionAt.value = 0;
    detectionsPerSecond.value = 0;
  }

  function stopLoop(): void {
    if (loopTimer) clearTimeout(loopTimer);
    loopTimer = null;
  }

  function releaseStream(): void {
    stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    stream = null;
    if (video) video.srcObject = null;
  }

  function fail(message: string): void {
    runId++;
    stopLoop();
    releaseStream();
    clearDetections();
    error.value = message;
    status.value = 'error';
  }

  async function refreshDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    devices.value = all
      .filter((device) => device.kind === 'videoinput' && device.deviceId)
      .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
  }

  function scheduleNext(id: number): void {
    loopTimer = setTimeout(() => runDetection(id), intervalMs);
  }

  function runDetection(id: number): void {
    if (id !== runId || !video || !detector) return;
    if (status.value !== 'monitoring') return;

    const now = performance.now();
    if (video.readyState >= 2 && video.videoWidth > 0) {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        lastVideoAdvanceAt = now;
        try {
          boxes.value = detector.detect(video, now);
        } catch (err) {
          fail(`Detection stopped: ${err instanceof Error ? err.message : 'unknown error'}.`);
          return;
        }
        frameSize.value = { width: video.videoWidth, height: video.videoHeight };
        lastDetectionAt.value = Date.now();

        rateWindowCount++;
        if (now - rateWindowStart >= 1000) {
          detectionsPerSecond.value = Math.round((rateWindowCount * 1000) / (now - rateWindowStart));
          rateWindowStart = now;
          rateWindowCount = 0;
        }
      } else if (now - lastVideoAdvanceAt > stallMs) {
        fail('The camera feed stopped sending frames. Check the webcam connection, then try again.');
        return;
      }
    }
    scheduleNext(id);
  }

  function startLoop(): void {
    stopLoop();
    const now = performance.now();
    lastVideoTime = -1;
    lastVideoAdvanceAt = now;
    rateWindowStart = now;
    rateWindowCount = 0;
    status.value = 'monitoring';
    if (document.visibilityState === 'hidden') {
      status.value = 'paused';
      return;
    }
    scheduleNext(runId);
  }

  async function openStream(id: number): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(window.isSecureContext ? 'This browser does not support camera access.' : 'Camera access requires HTTPS. Open the site over https://.');
    }
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId.value ? { deviceId: { exact: deviceId.value } } : true,
    };

    let next: MediaStream;
    try {
      next = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // A remembered camera may be unplugged or its ID may have changed: fall back to any camera once.
      if (deviceId.value && err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
        deviceId.value = null;
        next = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } else {
        throw err;
      }
    }
    if (id !== runId) {
      next.getTracks().forEach((track) => track.stop());
      return;
    }

    stream = next;
    const track = stream.getVideoTracks()[0];
    const activeId = track?.getSettings().deviceId;
    if (activeId) {
      deviceId.value = activeId;
      storeDevice(activeId);
    }
    if (track) track.onended = () => fail('The camera was disconnected. Plug it back in, then press Start monitoring.');

    await refreshDevices();
    if (!video) throw new Error('Video element is not ready.');
    video.srcObject = stream;
    await video.play();
  }

  async function start(): Promise<void> {
    const id = ++runId;
    stopLoop();
    releaseStream();
    clearDetections();
    error.value = null;

    try {
      status.value = 'requesting';
      await openStream(id);
      if (id !== runId) return;
    } catch (err) {
      if (id === runId) fail(err instanceof Error && err.message.startsWith('Camera access requires') ? err.message : describeCameraError(err));
      return;
    }

    try {
      status.value = 'loading';
      detector = await loadDetector(minScore);
      delegate.value = detector.delegate;
    } catch (err) {
      if (id === runId) fail(`The detection model failed to load. Check the internet connection, then try again. (${err instanceof Error ? err.message : 'unknown error'})`);
      return;
    }
    if (id !== runId) return;
    startLoop();
  }

  function stop(): void {
    runId++;
    stopLoop();
    releaseStream();
    clearDetections();
    error.value = null;
    status.value = 'idle';
  }

  async function selectDevice(id: string): Promise<void> {
    deviceId.value = id;
    storeDevice(id);
    if (active.value) await start();
  }

  function attach(element: HTMLVideoElement | null): void {
    video = element;
    if (video) {
      video.muted = true;
      video.playsInline = true;
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden' && status.value === 'monitoring') {
      stopLoop();
      clearDetections();
      status.value = 'paused';
    } else if (document.visibilityState === 'visible' && status.value === 'paused') {
      startLoop();
    }
  }

  const onDeviceChange = () => void refreshDevices();
  document.addEventListener('visibilitychange', onVisibilityChange);
  navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
  void refreshDevices();

  onScopeDispose(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
  });

  return {
    status,
    error,
    devices,
    deviceId,
    boxes,
    frameSize,
    count,
    active,
    lastDetectionAt,
    detectionsPerSecond,
    delegate,
    attach,
    start,
    stop,
    selectDevice,
  };
}

export type WebcamDetection = ReturnType<typeof useWebcamDetection>;
