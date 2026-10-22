import type { Detection, ObjectDetector } from '@mediapipe/tasks-vision';

/** A detected person, normalised to 0..1 of the video frame. */
export interface PersonBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface PersonDetector {
  readonly delegate: 'GPU' | 'CPU';
  detect(video: HTMLVideoElement, timestampMs: number): PersonBox[];
  close(): void;
}

// Served from our own origin: the model is committed under public/models, the
// runtime is copied from the pinned npm package by scripts/copy-mediapipe-wasm.mjs.
export const MODEL_URL = `${import.meta.env.BASE_URL}models/efficientdet_lite0_fp16.tflite`;
export const WASM_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Keeps confident `person` detections and converts pixel boxes to 0..1 of the frame. */
export function toPersonBoxes(detections: Detection[], frameWidth: number, frameHeight: number, minScore: number): PersonBox[] {
  if (frameWidth <= 0 || frameHeight <= 0) return [];
  const boxes: PersonBox[] = [];
  for (const detection of detections) {
    const person = detection.categories.find((category) => category.categoryName === 'person');
    const box = detection.boundingBox;
    if (!person || !box || person.score < minScore) continue;
    const x = clamp01(box.originX / frameWidth);
    const y = clamp01(box.originY / frameHeight);
    const width = clamp01((box.originX + box.width) / frameWidth) - x;
    const height = clamp01((box.originY + box.height) / frameHeight) - y;
    if (width > 0 && height > 0) boxes.push({ x, y, width, height, score: person.score });
  }
  return boxes;
}

/**
 * Loads the MediaPipe object detector (EfficientDet-Lite0, COCO classes) limited
 * to people. Tries the GPU first and falls back to the CPU.
 */
export async function createPersonDetector(minScore: number): Promise<PersonDetector> {
  const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

  const create = (delegate: 'GPU' | 'CPU') =>
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      categoryAllowlist: ['person'],
      scoreThreshold: minScore,
      maxResults: 50,
    });

  let delegate: 'GPU' | 'CPU' = 'GPU';
  let detector: ObjectDetector;
  try {
    detector = await create('GPU');
  } catch {
    delegate = 'CPU';
    detector = await create('CPU');
  }

  return {
    delegate,
    detect(video, timestampMs) {
      const result = detector.detectForVideo(video, timestampMs);
      return toPersonBoxes(result.detections, video.videoWidth, video.videoHeight, minScore);
    },
    close() {
      detector.close();
    },
  };
}
