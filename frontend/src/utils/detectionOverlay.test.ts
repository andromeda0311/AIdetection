import { describe, expect, it } from 'vitest';
import { boxToDisplay, containRect } from './detectionOverlay';

describe('containRect', () => {
  it('letterboxes a 16:9 frame in a taller element (bars top and bottom)', () => {
    expect(containRect(1280, 720, 640, 480)).toEqual({ x: 0, y: 60, width: 640, height: 360 });
  });

  it('pillarboxes a 4:3 frame in a wide element (bars left and right)', () => {
    expect(containRect(640, 480, 1000, 480)).toEqual({ x: 180, y: 0, width: 640, height: 480 });
  });

  it('returns an empty rect before the video has a size', () => {
    expect(containRect(0, 0, 640, 480)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('boxToDisplay', () => {
  const content = { x: 0, y: 60, width: 640, height: 360 };
  const box = { x: 0.1, y: 0.25, width: 0.2, height: 0.5, score: 0.9 };

  it('maps a normalised box into the displayed video area', () => {
    expect(boxToDisplay(box, content)).toEqual({ x: 64, y: 150, width: 128, height: 180 });
  });

  it('mirrors horizontally when the video is mirrored', () => {
    expect(boxToDisplay(box, content, true)).toEqual({ x: 448, y: 150, width: 128, height: 180 });
  });
});
