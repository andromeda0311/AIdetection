import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  className: string;
}

export interface DetectedFrame {
  index: number;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  pedestrianCount: number;
  boxes: DetectionBox[];
}

export interface DetectionApiResult {
  frames: DetectedFrame[];
  totalPedestrians: number;
  meta: Record<string, unknown>;
}

export interface DetectionVideoInput {
  filePath: string;
  fileName: string;
  contentType: string;
}

export interface DetectionClient {
  detectVideo(input: DetectionVideoInput): Promise<DetectionApiResult>;
}

interface YoloVideoApiFrame {
  index: number;
  contentType: string;
  base64: string;
  pedestrianCount: number;
  boxes: DetectionBox[];
}

interface YoloVideoApiResponse {
  totalPedestrians: number;
  meta: Record<string, unknown>;
  annotatedVideo: {
    contentType: string;
    base64: string;
    pedestrianCount: number;
  };
  frames: YoloVideoApiFrame[];
}

/**
 * Simulated client for offline development when the Python YOLO service is unavailable.
 * Returns the original video without drawn boxes — use YoloHttpDetectionClient for real output.
 */
export class MockDetectionClient implements DetectionClient {
  async detectVideo(input: DetectionVideoInput): Promise<DetectionApiResult> {
    logger.warn('MockDetectionClient is active — start yolo-service and set DETECTION_MOCK=false for real bounding boxes.');
    const buffer = await fs.readFile(input.filePath);
    const pedestrianCount = config.detection.mockPedestrians;

    const boxes: DetectionBox[] = Array.from({ length: pedestrianCount }, (_, i) => ({
      x1: 100 + i * 40,
      y1: 120,
      x2: 180 + i * 40,
      y2: 340,
      confidence: 0.92,
      className: 'person',
    }));

    return {
      frames: [
        {
          index: 0,
          fileName: 'annotated.mp4',
          contentType: input.contentType,
          buffer,
          pedestrianCount,
          boxes,
        },
      ],
      totalPedestrians: pedestrianCount,
      meta: { model: 'mock-yolov11', api: 'mock', annotated: false },
    };
  }
}

/** Calls the local Python YOLO service to produce an annotated video and sample frames. */
export class YoloHttpDetectionClient implements DetectionClient {
  constructor(
    private readonly options: { apiUrl: string; timeoutMs: number },
  ) {}

  async detectVideo(input: DetectionVideoInput): Promise<DetectionApiResult> {
    const buffer = await fs.readFile(input.filePath);
    const form = new FormData();
    const blob = new Blob([buffer], { type: input.contentType });
    form.append('file', blob, input.fileName);

    const url = `${this.options.apiUrl.replace(/\/$/, '')}/detect/video`;
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`YOLO video detection failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as YoloVideoApiResponse;
    const frames: DetectedFrame[] = [
      {
        index: 0,
        fileName: `annotated${path.extname(input.fileName) || '.mp4'}`,
        contentType: payload.annotatedVideo.contentType,
        buffer: Buffer.from(payload.annotatedVideo.base64, 'base64'),
        pedestrianCount: payload.annotatedVideo.pedestrianCount,
        boxes: [],
      },
      ...payload.frames.map((frame) => ({
        index: frame.index + 1,
        fileName: `frame_${String(frame.index + 1).padStart(4, '0')}.jpg`,
        contentType: frame.contentType,
        buffer: Buffer.from(frame.base64, 'base64'),
        pedestrianCount: frame.pedestrianCount,
        boxes: frame.boxes,
      })),
    ];

    return {
      frames,
      totalPedestrians: payload.totalPedestrians,
      meta: payload.meta,
    };
  }
}

export function createDetectionClient(configuration: {
  mock: boolean;
  apiUrl: string;
  timeoutMs: number;
}): DetectionClient {
  if (configuration.mock || !configuration.apiUrl) {
    return new MockDetectionClient();
  }
  return new YoloHttpDetectionClient({
    apiUrl: configuration.apiUrl,
    timeoutMs: configuration.timeoutMs,
  });
}

export const detectionClient = createDetectionClient(config.detection);
