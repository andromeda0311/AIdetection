<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { listYoloCameras, selectYoloCamera, yoloVideoStreamUrl } from '../api/yolo';
import type { LiveSystemState, YoloCameraInfo } from '../types';

const props = defineProps<{
  streamUrl: string;
  liveState: LiveSystemState | null;
  offline?: boolean;
}>();

const toast = useToast();

const streamLoaded = ref(false);
const streamRef = ref<HTMLImageElement | null>(null);
const cameras = ref<YoloCameraInfo[]>([]);
const selectedCameraIndex = ref<number | null>(null);
const switchingCamera = ref(false);
const loadingCameras = ref(false);
const streamCacheBust = ref(Date.now());
const suppressCameraChange = ref(true);

const detections = computed(() => props.liveState?.detections ?? []);

const activeStreamUrl = computed(() =>
  yoloVideoStreamUrl(props.streamUrl, streamCacheBust.value),
);

const statusLabel = computed(() => {
  if (props.offline || props.liveState?.yolo === 'offline') return 'Offline';
  if (props.liveState?.pedestrianDetected) return 'Pedestrian detected';
  return 'Monitoring — clear';
});

const statusClass = computed(() => {
  if (props.offline || props.liveState?.yolo === 'offline') return 'live-panel__status--offline';
  if (props.liveState?.pedestrianDetected) return 'live-panel__status--alert';
  return 'live-panel__status--clear';
});

const isCameraRowDisabled = computed(() =>
  switchingCamera.value || props.offline || props.liveState?.yolo === 'offline',
);

function onStreamLoad() {
  streamLoaded.value = true;
}

async function loadCameras() {
  loadingCameras.value = true;
  try {
    const response = await listYoloCameras();
    const activeIndex = response.indexes[0] ?? response.cameras[0]?.index ?? 0;
    cameras.value = response.cameras.length > 0
      ? response.cameras
      : [{ index: activeIndex, label: `Camera ${activeIndex} (active)` }];
    suppressCameraChange.value = true;
    selectedCameraIndex.value = activeIndex;
    await nextTick();
    suppressCameraChange.value = false;
  } catch {
    const fallbackIndex = selectedCameraIndex.value ?? 0;
    cameras.value = [{ index: fallbackIndex, label: `Camera ${fallbackIndex}` }];
    suppressCameraChange.value = false;
  } finally {
    loadingCameras.value = false;
  }
}

async function onCameraChange(index: number | null) {
  const nextIndex = index === null ? null : Number(index);
  if (
    suppressCameraChange.value
    || nextIndex === null
    || Number.isNaN(nextIndex)
    || switchingCamera.value
    || nextIndex === selectedCameraIndex.value
  ) {
    return;
  }

  switchingCamera.value = true;
  streamLoaded.value = false;

  try {
    const activeIndex = await selectYoloCamera(nextIndex);
    suppressCameraChange.value = true;
    selectedCameraIndex.value = activeIndex;
    await nextTick();
    suppressCameraChange.value = false;
    streamCacheBust.value = Date.now();
    await loadCameras();
    toast.add({
      severity: 'success',
      summary: 'Camera switched',
      detail: `Now using camera ${activeIndex}.`,
      life: 2500,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Camera switch failed',
      detail: err instanceof Error ? err.message : 'Could not switch camera.',
      life: 4000,
    });
    await loadCameras();
  } finally {
    switchingCamera.value = false;
  }
}

function handleCameraSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const index = value === '' ? null : Number(value);
  onCameraChange(index);
}

watch(
  () => props.liveState?.yolo,
  (status, previous) => {
    if (status === 'online' && previous !== 'online') {
      void loadCameras();
    }
  },
);

watch(
  () => props.streamUrl,
  () => {
    streamLoaded.value = false;
    streamCacheBust.value = Date.now();
  },
);

onMounted(() => {
  void loadCameras();
  void nextTick(() => {
    if (streamRef.value?.complete) streamLoaded.value = true;
  });
});
</script>

<template>
  <section class="live-panel">
    <div class="live-panel__header">
      <div>
        <h3 class="live-panel__title">Live annotated feed</h3>
        <p class="live-panel__subtitle">Bounding boxes are drawn once on the video stream by the YOLO service</p>
      </div>
      <span class="live-panel__status" :class="statusClass">{{ statusLabel }}</span>
    </div>

    <div class="live-panel__body">
      <div class="live-panel__camera-row">
        <label class="live-panel__camera-label" for="camera-select">Camera input</label>
        <select
          id="camera-select"
          class="live-panel__camera-select"
          :value="selectedCameraIndex ?? ''"
          :disabled="isCameraRowDisabled"
          @change="handleCameraSelect"
          aria-describedby="camera-select-hint"
        >
          <option value="" disabled>Select a webcam</option>
          <option
            v-for="cam in cameras"
            :key="cam.index"
            :value="cam.index"
          >
            {{ cam.label }}
          </option>
        </select>
        <span id="camera-select-hint" class="live-panel__camera-hint" v-if="loadingCameras" aria-live="polite">
          <span class="spinner" aria-hidden="true" />
          Loading cameras…
        </span>
        <button
          class="live-panel__refresh"
          type="button"
          aria-label="Refresh camera list"
          :disabled="isCameraRowDisabled"
          @click="loadCameras"
        >
          <i class="pi pi-refresh" aria-hidden="true" />
        </button>
      </div>

      <div class="live-panel__viewport">
        <img
          v-if="!offline && liveState?.yolo !== 'offline'"
          ref="streamRef"
          :src="activeStreamUrl"
          alt="Live YOLO detection feed with bounding boxes"
          class="live-panel__stream"
          @load="onStreamLoad"
        />
        <div v-else class="live-panel__offline">
          <i class="pi pi-video-slash" aria-hidden="true" />
          <span>Start yolo-service to view the live annotated feed</span>
        </div>

        <div
          v-if="liveState?.pedestrianDetected"
          class="live-panel__overlay live-panel__overlay--alert"
          role="status"
          aria-live="polite"
        >
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ liveState.pedestrianCount }} pedestrian(s) in crosswalk zone
        </div>

        <div v-if="liveState?.traffic === 'caution'" class="live-panel__overlay live-panel__overlay--caution">
          Caution — preparing to stop
        </div>

        <div v-if="liveState?.traffic === 'stopped'" class="live-panel__overlay live-panel__overlay--traffic">
          Traffic stopped
        </div>
      </div>

      <div class="live-panel__boxes">
        <div class="live-panel__boxes-header">
          <h4 class="live-panel__boxes-title">Current detections</h4>
          <span class="live-panel__boxes-count">{{ detections.length }} box(es)</span>
        </div>

        <p v-if="!liveState?.pedestrianDetected" class="live-panel__boxes-empty">
          No pedestrians detected in the current frame.
        </p>

        <ul v-else class="live-panel__box-list">
          <li v-for="(box, index) in detections" :key="index" class="live-panel__box-item">
            <span class="live-panel__box-class">{{ box.className }}</span>
            <span class="live-panel__box-confidence">{{ (box.confidence * 100).toFixed(0) }}%</span>
            <span class="live-panel__box-coords">
              ({{ Math.round(box.x1) }}, {{ Math.round(box.y1) }}) →
              ({{ Math.round(box.x2) }}, {{ Math.round(box.y2) }})
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.live-panel__body {
  padding: var(--space-4) var(--space-5) var(--space-2);
}

.live-panel__camera-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.live-panel__camera-label {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  white-space: nowrap;
}

.live-panel__camera-select {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  font: var(--fs-sm) 'Inter', system-ui, sans-serif;
  color: var(--c-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a5f66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 1rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.live-panel__camera-select:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-ring);
}

.live-panel__camera-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-surface-hover);
}

.live-panel__refresh {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background-color: var(--color-surface);
  color: var(--c-text);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.live-panel__refresh:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border);
}

.live-panel__refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color-border);
  border-right-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
