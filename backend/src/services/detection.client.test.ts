import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockDetectionClient } from './detection.client.js';

let dir: string;
let filePath: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mock-client-'));
  filePath = path.join(dir, 'clip.mp4');
  await writeFile(filePath, Buffer.from('fake-video-bytes'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('MockDetectionClient', () => {
  it('returns a frame with the video content and simulated detections', async () => {
    const client = new MockDetectionClient();
    const result = await client.detectVideo({
      filePath,
      fileName: 'clip.mp4',
      contentType: 'video/mp4',
    });

    expect(result.frames.length).toBe(1);
    expect(result.frames[0].contentType).toBe('video/mp4');
    expect(result.frames[0].buffer.toString()).toBe('fake-video-bytes');
    expect(result.totalPedestrians).toBeGreaterThanOrEqual(0);
    expect(typeof result.meta).toBe('object');

    for (const frame of result.frames) {
      expect(frame).toHaveProperty('index');
      expect(frame).toHaveProperty('fileName');
      expect(Array.isArray(frame.boxes)).toBe(true);
      expect(frame.pedestrianCount).toBe(frame.boxes.length);
    }
  });
});
