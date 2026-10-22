import { describe, expect, it } from 'vitest';
import type { Detection } from '@mediapipe/tasks-vision';
import { MODEL_URL, WASM_URL, toPersonBoxes } from './personDetector';

function detection(categoryName: string, score: number, box?: { originX: number; originY: number; width: number; height: number }): Detection {
  return {
    categories: [{ categoryName, score, index: 0, displayName: '' }],
    boundingBox: box ? { ...box, angle: 0 } : undefined,
    keypoints: [],
  };
}

describe('toPersonBoxes', () => {
  it('normalises confident person boxes to 0..1 of the frame', () => {
    const boxes = toPersonBoxes([detection('person', 0.9, { originX: 64, originY: 36, width: 128, height: 180 })], 640, 360, 0.5);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].x).toBeCloseTo(0.1);
    expect(boxes[0].y).toBeCloseTo(0.1);
    expect(boxes[0].width).toBeCloseTo(0.2);
    expect(boxes[0].height).toBeCloseTo(0.5);
    expect(boxes[0].score).toBe(0.9);
  });

  it('counts zero, one and several people', () => {
    const person = (x: number) => detection('person', 0.8, { originX: x, originY: 10, width: 50, height: 100 });
    expect(toPersonBoxes([], 640, 360, 0.5)).toHaveLength(0);
    expect(toPersonBoxes([person(0)], 640, 360, 0.5)).toHaveLength(1);
    expect(toPersonBoxes([person(0), person(100), person(200)], 640, 360, 0.5)).toHaveLength(3);
  });

  it('drops other classes, low scores and detections without a box', () => {
    const box = { originX: 0, originY: 0, width: 10, height: 10 };
    const boxes = toPersonBoxes(
      [detection('car', 0.99, box), detection('person', 0.3, box), detection('person', 0.9)],
      640,
      360,
      0.5,
    );
    expect(boxes).toEqual([]);
  });

  it('clips boxes that extend past the frame edge', () => {
    const [box] = toPersonBoxes([detection('person', 0.9, { originX: -20, originY: 300, width: 100, height: 100 })], 640, 360, 0.5);
    expect(box.x).toBe(0);
    expect(box.y + box.height).toBeCloseTo(1);
    expect(box.width).toBeCloseTo(80 / 640);
  });

  it('returns nothing while the frame size is unknown', () => {
    expect(toPersonBoxes([detection('person', 0.9, { originX: 0, originY: 0, width: 1, height: 1 })], 0, 0, 0.5)).toEqual([]);
  });

  it('loads the model and runtime relative to the deployment base path', () => {
    expect(MODEL_URL).toBe(`${import.meta.env.BASE_URL}models/efficientdet_lite0_fp16.tflite`);
    expect(WASM_URL).toBe(`${import.meta.env.BASE_URL}mediapipe/wasm`);
  });
});
