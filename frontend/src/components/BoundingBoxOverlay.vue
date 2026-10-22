<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { DetectionBox, LiveDetectionBox } from '../types';

type BoxInput = DetectionBox | LiveDetectionBox;

const props = defineProps<{
  boxes: BoxInput[];
  frameWidth?: number;
  frameHeight?: number;
  active?: boolean;
}>();

const containerRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

function getClassName(box: BoxInput): string {
  return box.className;
}

function draw() {
  const container = containerRef.value;
  const canvas = canvasRef.value;
  if (!container || !canvas || !props.active || props.boxes.length === 0) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 0 || height <= 0) return;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  const sourceWidth = props.frameWidth && props.frameWidth > 0 ? props.frameWidth : width;
  const sourceHeight = props.frameHeight && props.frameHeight > 0 ? props.frameHeight : height;
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;

  for (const box of props.boxes) {
    const x = box.x1 * scaleX;
    const y = box.y1 * scaleY;
    const w = (box.x2 - box.x1) * scaleX;
    const h = (box.y2 - box.y1) * scaleY;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    const label = `${getClassName(box)} ${(box.confidence * 100).toFixed(0)}%`;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const labelHeight = 22;
    const labelY = Math.max(0, y - labelHeight);

    ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
    ctx.fillRect(x, labelY, textWidth + 10, labelHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 5, labelY + 15);
  }
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(containerRef.value);
  }
  draw();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(
  () => [props.boxes, props.frameWidth, props.frameHeight, props.active],
  () => draw(),
  { deep: true },
);
</script>

<template>
  <div ref="containerRef" class="bbox-overlay">
    <slot />
    <canvas ref="canvasRef" class="bbox-overlay__canvas" aria-hidden="true" />
  </div>
</template>

<style scoped>
.bbox-overlay {
  position: relative;
  width: 100%;
  height: 100%;
}

.bbox-overlay__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
