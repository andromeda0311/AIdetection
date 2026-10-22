import type { PersonBox } from './personDetector';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a video frame is drawn inside its element under `object-fit: contain` (letterboxed). */
export function containRect(frameWidth: number, frameHeight: number, elementWidth: number, elementHeight: number): Rect {
  if (frameWidth <= 0 || frameHeight <= 0 || elementWidth <= 0 || elementHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(elementWidth / frameWidth, elementHeight / frameHeight);
  const width = frameWidth * scale;
  const height = frameHeight * scale;
  return { x: (elementWidth - width) / 2, y: (elementHeight - height) / 2, width, height };
}

/** Maps a normalised box onto the displayed video area. `mirrored` flips it horizontally. */
export function boxToDisplay(box: PersonBox, content: Rect, mirrored = false): Rect {
  const x = mirrored ? 1 - box.x - box.width : box.x;
  return {
    x: content.x + x * content.width,
    y: content.y + box.y * content.height,
    width: box.width * content.width,
    height: box.height * content.height,
  };
}

/** Sizes the canvas to its CSS box (sharp on high-DPI screens) and draws labelled person boxes. */
export function drawPersonBoxes(canvas: HTMLCanvasElement, boxes: PersonBox[], frameWidth: number, frameHeight: number, mirrored = false): void {
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (!boxes.length) return;

  const content = containRect(frameWidth, frameHeight, cssWidth, cssHeight);
  ctx.lineWidth = 2;
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  for (const box of boxes) {
    const rect = boxToDisplay(box, content, mirrored);
    ctx.strokeStyle = '#36d374';
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    const label = `Person ${Math.round(box.score * 100)}%`;
    const labelWidth = ctx.measureText(label).width + 10;
    const labelY = rect.y >= 18 ? rect.y - 18 : rect.y;
    ctx.fillStyle = '#31bd69';
    ctx.fillRect(rect.x - 1, labelY, labelWidth, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, rect.x + 4, labelY + 9);
  }
}
