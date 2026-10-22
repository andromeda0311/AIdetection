<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { listYoloCameras, yoloVideoStreamUrlForIndex } from '@/api/yolo';
import type { LiveCameraView, LiveSystemState } from '@/types';

const props = defineProps<{
  liveState: LiveSystemState | null;
  offline?: boolean;
}>();

const serviceOffline = computed(() => props.offline || !props.liveState || props.liveState.yolo === 'offline' || props.liveState.camera === 'offline');

const cameras = ref<LiveCameraView[]>([]);
const camerasFromState = computed(() => props.liveState?.cameras ?? []);
const cameraNames = ref<Record<number, string>>({});
const loadingCameras = ref(false);
const cacheBust = ref(Date.now());

const fusedStatusLabel = computed(() => {
  if (serviceOffline.value) return 'Offline';
  if (props.liveState?.pedestrianDetected) {
    return `Pedestrian detected (${props.liveState.pedestrianCount})`;
  }
  return 'Monitoring — clear';
});

const fusedStatusClass = computed(() => {
  if (serviceOffline.value) return 'mc-grid__status--offline';
  if (props.liveState?.pedestrianDetected) return 'mc-grid__status--alert';
  return 'mc-grid__status--clear';
});

const degraded = computed(() => Boolean(props.liveState?.degraded) && !serviceOffline.value);
const fusionMode = computed(() => props.liveState?.fusionMode ?? '');

function tileStatus(camera: LiveCameraView) {
  if (serviceOffline.value || !camera.online) return 'offline';
  if (camera.detected) return 'alert';
  return 'clear';
}

function tileStatusLabelFor(camera: LiveCameraView) {
  const status = tileStatus(camera);
  if (status === 'offline') return 'Offline';
  if (status === 'alert') return `Pedestrian detected (${camera.count})`;
  return 'Monitoring — clear';
}

function tileStatusClassFor(camera: LiveCameraView) {
  const status = tileStatus(camera);
  return `mc-tile__status--${status}`;
}

function streamUrlFor(camera: LiveCameraView) {
  return yoloVideoStreamUrlForIndex(camera.index, cacheBust.value);
}

function nameFor(camera: LiveCameraView) {
  return camera.name ?? cameraNames.value[camera.index] ?? `Camera ${camera.index}`;
}

function syntheticViews(list: Array<{ index: number; label?: string }>): LiveCameraView[] {
  return list.map((camera) => ({
    index: camera.index,
    online: !serviceOffline.value,
    detected: false,
    count: 0,
    confidence: 0,
    detections: [],
    frameWidth: 0,
    frameHeight: 0,
  }));
}

async function loadCameras() {
  loadingCameras.value = true;
  try {
    const response = await listYoloCameras();
    const names: Record<number, string> = {};
    for (const camera of response.cameras) {
      if (camera.name) {
        names[camera.index] = camera.name;
      }
    }
    cameraNames.value = names;
    cameras.value = syntheticViews(response.cameras);
  } catch {
    const fallbackIndex = camerasFromState.value[0]?.index ?? 0;
    cameras.value = syntheticViews([{ index: fallbackIndex }]);
  } finally {
    loadingCameras.value = false;
  }
}

watch(camerasFromState, (next) => {
  if (next.length > 0) {
    cameras.value = next;
  }
});

watch(
  () => props.liveState?.yolo,
  (status, previous) => {
    if (status === 'online' && previous !== 'online') {
      cacheBust.value = Date.now();
      if (camerasFromState.value.length === 0) {
        void loadCameras();
      }
    }
  },
);

onMounted(() => {
  if (camerasFromState.value.length === 0) {
    void loadCameras();
  }
});

onBeforeUnmount(() => {
  cameras.value = [];
});
</script>

<template>
  <section class="mc-grid" aria-label="Live multi-camera detection feed">
    <div class="mc-grid__header">
      <div>
        <h3 class="mc-grid__title">Live camera feeds</h3>
        <p class="mc-grid__subtitle">
          Camera views and detection updates in one place.
        </p>
      </div>
      <div class="mc-grid__status-row">
        <span v-if="fusionMode" class="mc-grid__chip">{{ fusionMode }}</span>
        <span
          v-if="degraded"
          class="mc-grid__chip mc-grid__chip--warning"
          role="status"
        >
          Degraded — some cameras offline
        </span>
        <span class="mc-grid__status" :class="fusedStatusClass">{{ fusedStatusLabel }}</span>
      </div>
    </div>

    <div v-if="loadingCameras && cameras.length === 0" class="mc-grid__loading">
      <span class="spinner" aria-hidden="true" />
      Loading cameras…
    </div>

    <div v-else-if="cameras.length === 0" class="mc-grid__offline">
      <i class="pi pi-video-slash" aria-hidden="true" />
      <span>No camera feed is available yet.</span>
    </div>

    <div v-else class="mc-grid__tiles">
      <article
        v-for="camera in cameras"
        :key="camera.index"
        class="mc-tile"
        :class="{ 'mc-tile--alert': tileStatus(camera) === 'alert' }"
      >
        <header class="mc-tile__header">
          <h4 class="mc-tile__name" :title="nameFor(camera)">{{ nameFor(camera) }}</h4>
          <span class="mc-tile__status" :class="tileStatusClassFor(camera)">
            {{ tileStatusLabelFor(camera) }}
          </span>
        </header>

        <div class="mc-tile__viewport">
          <img
            v-if="!serviceOffline && camera.online"
            :src="streamUrlFor(camera)"
            :alt="`Live YOLO detection feed from camera ${camera.index}`"
            class="mc-tile__stream"
          />
          <div v-else class="mc-tile__offline">
            <i class="pi pi-video-slash" aria-hidden="true" />
            <span>Camera unavailable</span>
          </div>

          <div
            v-if="!serviceOffline && camera.online && camera.detected"
            class="mc-tile__overlay mc-tile__overlay--alert"
            role="status"
            aria-live="polite"
          >
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            {{ camera.count }} pedestrian(s) detected
          </div>
        </div>

        <div class="mc-tile__boxes">
          <p v-if="camera.detections.length === 0" class="mc-tile__boxes-empty">
            {{ serviceOffline || !camera.online ? 'Waiting for a camera connection.' : 'No people detected in this frame.' }}
          </p>
          <ul v-else class="mc-tile__box-list">
            <li
              v-for="(box, boxIndex) in camera.detections"
              :key="boxIndex"
              class="mc-tile__box-item"
            >
              <span class="mc-tile__box-class">{{ box.className }}</span>
              <span class="mc-tile__box-confidence">{{ (box.confidence * 100).toFixed(0) }}%</span>
              <span class="mc-tile__box-coords">
                ({{ Math.round(box.x1) }}, {{ Math.round(box.y1) }}) →
                ({{ Math.round(box.x2) }}, {{ Math.round(box.y2) }})
              </span>
            </li>
          </ul>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mc-grid { border:1px solid var(--c-border); border-radius:16px; padding:24px; background:var(--c-surface); box-shadow:var(--shadow-1); min-width:0; }
.mc-tile__viewport { aspect-ratio:16 / 9 !important; background:#182723 !important; }
.mc-tile__offline { color:#b5c9bf !important; }
.mc-tile__offline i { font-size:28px; margin-bottom:8px; }
.mc-grid__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.mc-grid__title {
  margin: 0;
  font-size: var(--fs-lg);
  color: var(--c-text);
}

.mc-grid__subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}

.mc-grid__status-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.mc-grid__chip {
  padding: 0.2rem 0.6rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-muted);
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  white-space: nowrap;
}

.mc-grid__chip--warning {
  color: var(--color-warning, #b45309);
  background-color: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
}

.mc-grid__status {
  padding: 0.3rem 0.8rem;
  font-size: var(--fs-sm);
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.mc-grid__status--clear {
  color: #15803d;
  background-color: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.mc-grid__status--alert {
  color: #b91c1c;
  background-color: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  animation: mc-pulse 1.6s ease-in-out infinite;
}

.mc-grid__status--offline {
  color: var(--c-text-muted);
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
}

@keyframes mc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.mc-grid__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8) 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.mc-grid__offline {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8) 0;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  background-color: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: 0.5rem;
}

.mc-grid__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.mc-tile {
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.mc-tile--alert {
  border-color: rgba(239, 68, 68, 0.55);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.mc-tile__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.mc-tile__name {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text);
}

.mc-tile__status {
  padding: 0.15rem 0.55rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.mc-tile__status--clear {
  color: #15803d;
  background-color: rgba(34, 197, 94, 0.12);
}

.mc-tile__status--alert {
  color: #b91c1c;
  background-color: rgba(239, 68, 68, 0.12);
}

.mc-tile__status--offline {
  color: var(--c-text-muted);
  background-color: var(--color-surface-hover);
}

.mc-tile__viewport {
  position: relative;
  aspect-ratio: 4 / 3;
  background-color: #0b0e11;
}

.mc-tile__stream {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mc-tile__offline {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.mc-tile__overlay {
  position: absolute;
  left: 50%;
  bottom: var(--space-2);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.3rem 0.75rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.mc-tile__overlay--alert {
  color: #fff;
  background-color: rgba(220, 38, 38, 0.92);
}

.mc-tile__boxes {
  padding: var(--space-2) var(--space-3);
}

.mc-tile__boxes-empty {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}

.mc-tile__box-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mc-tile__box-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}

.mc-tile__box-class {
  font-weight: 600;
  color: var(--c-text);
}

.mc-tile__box-confidence {
  font-weight: 600;
  color: #15803d;
}

.mc-tile__box-coords {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color-border);
  border-right-color: var(--color-accent);
  border-radius: 50%;
  animation: mc-spin 0.6s linear infinite;
}

@keyframes mc-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .mc-grid__tiles {
    grid-template-columns: 1fr;
  }
}
</style>
