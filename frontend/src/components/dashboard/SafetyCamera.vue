<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SafetyIcon from './SafetyIcon.vue';
import { drawPersonBoxes } from '@/utils/detectionOverlay';
import type { WebcamDetection } from '@/composables/useWebcamDetection';
const props = defineProps<{ detection: WebcamDetection; preview: boolean }>();
const { status, error, devices, deviceId, boxes, frameSize, count, active, detectionsPerSecond, stream } = props.detection;

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const showSample = computed(() => props.preview && status.value === 'idle');
const live = computed(() => status.value === 'monitoring');
const detected = computed(() => showSample.value || (count.value ?? 0) > 0);
const badge = computed(() => showSample.value ? 'Sample' : live.value ? 'Live' : status.value === 'paused' ? 'Paused' : 'Offline');
const overlayMessage = computed(() => ({
  idle: 'Connect the webcam, then press Start monitoring.',
  requesting: 'Waiting for camera permission…',
  loading: 'Loading the detection model…',
  paused: 'Paused while this tab is in the background.',
  error: error.value ?? 'The camera could not be started.',
  monitoring: '',
})[status.value]);
const barText = computed(() => {
  if (showSample.value) return 'Pedestrian detected';
  if (!live.value) return status.value === 'paused' ? 'Detection paused' : 'Detection not running';
  return count.value ? `${count.value} ${count.value === 1 ? 'person' : 'people'} in view` : 'Monitoring for pedestrians';
});

function redraw() {
  if (!canvasEl.value) return;
  drawPersonBoxes(canvasEl.value, live.value ? boxes.value : [], frameSize.value.width, frameSize.value.height);
}
watch([boxes, live], redraw);
// Detection runs on its own video element; this one only displays the same stream.
watch([stream, videoEl], ([current, element]) => {
  if (!element || element.srcObject === current) return;
  element.srcObject = current;
  if (current) void element.play().catch(() => undefined);
}, { immediate: true });

const expanded = ref(false);
const expandButton = ref<HTMLButtonElement | null>(null);
function toggleExpanded() { expanded.value = !expanded.value; }
function onKey(event: KeyboardEvent) { if (event.key === 'Escape' && expanded.value) { expanded.value = false; expandButton.value?.focus(); } }
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  window.addEventListener('keydown', onKey);
  if (canvasEl.value && 'ResizeObserver' in window) { resizeObserver = new ResizeObserver(redraw); resizeObserver.observe(canvasEl.value); }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  resizeObserver?.disconnect();
  // Monitoring continues on other pages; only the display is released.
  if (videoEl.value) videoEl.value.srcObject = null;
});
function onSelectDevice(event: Event) { void props.detection.selectDevice((event.target as HTMLSelectElement).value); }
</script>
<template>
  <section class="safety-card webcam-card" :class="{ 'webcam-card--expanded': expanded }"><header class="safety-card__header"><h2><SafetyIcon name="video" />Webcam Detection</h2><div class="camera-header-actions"><slot name="actions" />
    <select v-if="devices.length > 1" class="camera-select" aria-label="Camera" :value="deviceId ?? ''" @change="onSelectDevice"><option v-for="device in devices" :key="device.deviceId" :value="device.deviceId">{{ device.label }}</option></select>
    <button v-if="active" type="button" class="camera-control camera-control--stop" @click="detection.stop()"><SafetyIcon name="stop" />Stop</button>
    <button v-else type="button" class="camera-control" @click="detection.start()"><SafetyIcon name="play" />{{ status === 'error' ? 'Try again' : 'Start monitoring' }}</button>
    <span class="camera-live-badge" :class="{ offline: !live && !showSample }" :title="live && detectionsPerSecond ? `${detectionsPerSecond} detections per second` : undefined"><span />{{ badge }}</span><button ref="expandButton" type="button" class="camera-expand" :aria-label="expanded ? 'Reduce camera panel' : 'Expand camera panel'" :aria-pressed="expanded" @click="toggleExpanded"><SafetyIcon :name="expanded ? 'minimize' : 'maximize'" /></button></div></header>
    <div class="camera-body"><div class="safety-video">
      <svg v-if="showSample" class="sample-camera-scene" viewBox="0 0 640 360" role="img" aria-label="Sample crosswalk illustration for design preview, not live footage"><defs><linearGradient id="sample-sky" x2="0" y2="1"><stop stop-color="#a8bac5" /><stop offset="1" stop-color="#dce1df" /></linearGradient></defs><rect width="640" height="360" fill="url(#sample-sky)" /><path d="M0 160h640v200H0z" fill="#767c7c" /><path d="M0 159h640v40H0z" fill="#c3c5bf" /><path d="M0 191h640v7H0z" fill="#e1e0d8" /><g fill="#84959c"><rect x="8" y="54" width="101" height="108" /><rect x="116" y="23" width="120" height="139" /><rect x="434" y="36" width="90" height="126" /><rect x="531" y="67" width="101" height="95" /></g><g fill="#c6d0d2"><path d="M23 73h70v12H23zM23 101h70v12H23zM23 131h70v12H23zM131 42h89v14h-89zM131 78h89v14h-89zM131 114h89v14h-89zM448 55h61v12h-61zM448 87h61v12h-61zM448 119h61v12h-61zM546 86h68v11h-68zM546 115h68v11h-68z" /></g><g fill="#f1f0e9"><path d="m110 243 75-16 74 133h-92zM249 227h50l42 133h-68zM351 227h50l16 133h-68zM453 227h50l-11 133h-68z" /></g><g fill="#527666"><circle cx="69" cy="155" r="28" /><circle cx="563" cy="152" r="34" /></g><g stroke="#6e6051" stroke-width="8"><path d="M69 158v44m494-46v48" /></g><g stroke-linecap="round" stroke-linejoin="round"><circle cx="328" cy="131" r="16" fill="#b68a6c" /><path d="m321 156-14 48 32 21 13-54z" fill="#244b63" /><path d="m315 164-20 39-25 15m70-49 29 25 24-8" stroke="#244b63" stroke-width="12" /><path d="m318 213-15 43-11 32m41-69 15 31 24 30" stroke="#2c3840" stroke-width="14" /><path d="m284 291 18 2m64-9 19 5" stroke="#1f2932" stroke-width="9" /></g><rect x="262" y="97" width="135" height="205" rx="2" fill="none" stroke="#36d374" stroke-width="2" /><rect x="261" y="79" width="136" height="18" fill="#31bd69" /><text x="267" y="92" fill="white" font-size="11" font-family="Inter, sans-serif">Pedestrian detected</text></svg>
      <video v-show="!showSample" ref="videoEl" class="safety-stream" muted playsinline aria-label="Live webcam feed with pedestrian detection" />
      <canvas v-show="live" ref="canvasEl" class="detection-overlay" aria-hidden="true" />
      <div v-if="!showSample && status !== 'monitoring'" class="camera-unavailable" :class="{ 'camera-unavailable--error': status === 'error' }" :role="status === 'error' ? 'alert' : 'status'"><SafetyIcon name="video" /><span>{{ overlayMessage }}</span></div>
      <span v-if="showSample" class="sample-camera-label">Sample camera visualization</span>
      <div class="camera-detection-bar"><SafetyIcon name="walk" /><span>{{ barText }}</span><span v-if="detected" class="detection-indicator" /></div>
    </div></div>
  </section>
</template>
