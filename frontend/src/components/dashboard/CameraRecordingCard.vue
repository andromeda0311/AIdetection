<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import AppCard from '@/components/ui/AppCard.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { 
  startRecording, 
  stopRecording, 
  listRecordings, 
  deleteRecording, 
  downloadRecording 
} from '@/api/recordings';
import type { RecordingInfo, RecordingStatus } from '@/types';
import { useLiveSystemState } from '@/composables/useLiveSystemState';

const { liveState } = useLiveSystemState();
const toast = useToast();

const recordings = ref<RecordingInfo[]>([]);
const loadingRecordings = ref(false);
const cameraIndex = ref<string>('0');

async function loadRecordings() {
  loadingRecordings.value = true;
  try {
    recordings.value = await listRecordings();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not load recordings', life: 4000 });
  } finally {
    loadingRecordings.value = false;
  }
}

async function handleStartRecording() {
  try {
    const result = await startRecording(parseInt(cameraIndex.value, 10) || 0);
    toast.add({ severity: 'success', summary: 'Recording started', detail: result.recordingId, life: 2500 });
    loadRecordings();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not start recording', life: 4000 });
  }
}

async function handleStopRecording() {
  try {
    const result = await stopRecording();
    toast.add({ severity: 'success', summary: 'Recording stopped', detail: `Saved: ${result.path} (${(result.size / 1024 / 1024).toFixed(1)} MB)`, life: 3000 });
    loadRecordings();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not stop recording', life: 4000 });
  }
}

async function handleDownload(recording: RecordingInfo) {
  try {
    await downloadRecording(recording.id);
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Download failed', detail: err instanceof Error ? err.message : 'Could not download', life: 4000 });
  }
}

async function handleDelete(recording: RecordingInfo) {
  if (!confirm(`Delete ${recording.filename}?`)) return;
  try {
    await deleteRecording(recording.id);
    toast.add({ severity: 'success', summary: 'Deleted', detail: 'Recording removed', life: 2500 });
    loadRecordings();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not delete', life: 4000 });
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const recordingStatus = computed(() => liveState.value?.recording ?? { status: 'idle' as const, startedAt: null, duration: 0, fileName: null });
const isRecording = computed(() => recordingStatus.value.status === 'recording');

onMounted(() => {
  loadRecordings();
  // Listen for recording status updates
  // Note: useLiveSystemState doesn't expose socket directly, but we can access it
  // The recording:status events are already handled in useLiveSystemState
});
</script>

<template>
  <AppCard title="Camera Recording" subtitle="Record live MJPEG stream to WebM/MP4" padding="sm">
    <!-- Recording Controls -->
    <div class="recording-controls">
      <div class="recording-status">
        <span class="recording-status__label">Status</span>
        <div class="recording-status__value" :class="{ 'recording-status__value--recording': isRecording }">
          <span v-if="isRecording" class="recording-indicator" aria-hidden="true">
            <span class="recording-dot" />
            REC
          </span>
          <span v-else>IDLE</span>
        </div>
        <div v-if="isRecording" class="recording-timer">
          {{ formatDuration(recordingStatus.duration) }}
        </div>
      </div>

      <div class="recording-actions">
        <AppButton
          v-if="!isRecording"
          label="Start Recording"
          severity="success"
          icon="pi pi-video"
          @click="handleStartRecording"
          :loading="loadingRecordings"
        />
        <AppButton
          v-else
          label="Stop Recording"
          severity="danger"
          icon="pi pi-stop"
          @click="handleStopRecording"
        />
      </div>
    </div>

    <!-- Camera Selection -->
    <div class="camera-select-section">
      <label class="camera-select__label" for="camera-index">Camera Index</label>
      <AppInput
        id="camera-index"
        v-model="cameraIndex"
        type="number"
        min="0"
        max="10"
        style="width: 80px"
      />
      <span class="camera-select__hint">Usually 0 for built-in webcam</span>
    </div>

    <!-- Saved Recordings -->
    <div class="recordings-list">
      <div class="recordings-list__header">
        <h4 class="recordings-list__title">Saved Recordings</h4>
        <span v-if="loadingRecordings" class="recordings-list__loading">Loading…</span>
      </div>

      <p v-if="!loadingRecordings && recordings.length === 0" class="recordings-list__empty">
        No recordings yet. Click "Start Recording" to create one.
      </p>

      <ul v-else class="recordings-list__items">
        <li v-for="rec in recordings" :key="rec.id" class="recordings-list__item">
          <div class="recordings-list__info">
            <span class="recordings-list__filename">{{ rec.filename }}</span>
            <div class="recordings-list__meta">
              <span>{{ formatSize(rec.size) }}</span>
              <span>•</span>
              <span>{{ new Date(rec.createdAt).toLocaleString() }}</span>
            </div>
          </div>
          <div class="recordings-list__actions">
            <AppButton
              label="Download"
              severity="secondary"
              size="sm"
              icon="pi pi-download"
              @click="handleDownload(rec)"
            />
            <AppButton
              label="Delete"
              severity="danger"
              size="sm"
              icon="pi pi-trash"
              @click="handleDelete(rec)"
            />
          </div>
        </li>
      </ul>
    </div>
  </AppCard>
</template>

<style scoped>
.recording-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.recording-status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.recording-status__label {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.recording-status__value {
  font-family: 'DSEG7 Classic', 'Courier New', monospace;
  font-size: var(--fs-base);
  font-weight: 600;
}

.recording-status__value--recording {
  color: var(--c-danger);
}

.recording-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-danger);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.recording-timer {
  font-family: 'DSEG7 Classic', 'Courier New', monospace;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--c-danger);
  background: var(--color-surface-hover);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 5ch;
  text-align: center;
}

.recording-actions { flex-shrink: 0; }

.camera-select-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.camera-select__label {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.camera-select__hint {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  margin-left: auto;
}

.recordings-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.recordings-list__title {
  font-size: var(--fs-base);
  font-weight: 600;
  margin: 0;
}

.recordings-list__loading {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}

.recordings-list__empty {
  text-align: center;
  padding: var(--space-4);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.recordings-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recordings-list__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  gap: var(--space-3);
}

.recordings-list__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.recordings-list__filename {
  font-weight: 500;
  font-size: var(--fs-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recordings-list__meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}

.recordings-list__actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>