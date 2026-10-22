<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import AppCard from '@/components/ui/AppCard.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { forceSignal, setSignalMode, setManualTimers, forcePhase } from '@/api';
import type { SignalState, SignalMode, ManualTimers } from '@/types';
import { useLiveSystemState } from '@/composables/useLiveSystemState';

const props = defineProps<{
  status: { state: SignalState; since: string } | null;
  forcing: boolean;
}>();

const { liveState, socket } = useLiveSystemState();
const toast = useToast();

const mode = ref<SignalMode>('auto');
const manualTimers = ref<ManualTimers>({ greenMs: 30000, yellowMs: 3000, redMs: 20000, pedWalkMs: 15000 });

// Computed for string/number conversion for v-model
const manualGreenMs = computed({
  get: () => String(manualTimers.value.greenMs),
  set: (v) => { manualTimers.value.greenMs = parseInt(v, 10) || 30000; },
});
const manualYellowMs = computed({
  get: () => String(manualTimers.value.yellowMs),
  set: (v) => { manualTimers.value.yellowMs = parseInt(v, 10) || 3000; },
});
const manualRedMs = computed({
  get: () => String(manualTimers.value.redMs),
  set: (v) => { manualTimers.value.redMs = parseInt(v, 10) || 20000; },
});
const manualPedWalkMs = computed({
  get: () => String(manualTimers.value.pedWalkMs),
  set: (v) => { manualTimers.value.pedWalkMs = parseInt(v, 10) || 15000; },
});
const customDuration = ref<string>('');
const savingTimers = ref(false);

const stateLabel = computed<Record<SignalState, string>>(() => ({
  GREEN: 'Green — Go',
  YELLOW: 'Yellow — Caution',
  RED: 'Red — Stop',
}));

function signalTagSeverity(state: SignalState) {
  if (state === 'GREEN') return 'success';
  if (state === 'YELLOW') return 'warning';
  return 'danger';
}

function modeSeverity(m: SignalMode) {
  return m === 'auto' ? 'success' : 'warning';
}

async function loadModeAndTimers() {
  if (!liveState.value) return;
  if (liveState.value.mode) mode.value = liveState.value.mode;
  if (liveState.value.manualTimers) manualTimers.value = liveState.value.manualTimers;
}

async function onModeChange(newMode: SignalMode) {
  mode.value = newMode;
  try {
    await setSignalMode(newMode);
    toast.add({ severity: 'success', summary: 'Mode changed', detail: `Switched to ${newMode.toUpperCase()} mode`, life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not change mode', life: 4000 });
    loadModeAndTimers(); // revert
  }
}

async function saveManualTimers() {
  savingTimers.value = true;
  try {
    await setManualTimers(manualTimers.value);
    toast.add({ severity: 'success', summary: 'Timers saved', detail: 'Manual timers updated', life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: err instanceof Error ? err.message : 'Could not save timers', life: 4000 });
  } finally {
    savingTimers.value = false;
  }
}

function forceWithDuration(state: SignalState) {
  const duration = customDuration.value ? parseInt(customDuration.value, 10) : undefined;
  forcePhase(state, duration);
  customDuration.value = '';
}

onMounted(() => {
  loadModeAndTimers();
  // Listen for mode/timer updates from WebSocket
  socket()?.on('signal:mode', (data: { mode: SignalMode }) => {
    mode.value = data.mode;
  });
  socket()?.on('signal:manualTimers', (data: ManualTimers) => {
    manualTimers.value = data;
  });
});
</script>

<template>
  <AppCard title="Traffic Signal" subtitle="Current light state and manual override" padding="sm">
    <div v-if="status">
      <div class="signal-display">
        <span
          class="signal-display__light"
          :class="`signal-display__light--${status.state.toLowerCase()}`"
          aria-hidden="true"
        />
        <div>
          <div class="signal-display__label">{{ stateLabel[status.state] }}</div>
          <div class="signal-display__meta">Active since {{ new Date(status.since).toLocaleTimeString() }}</div>
        </div>
      </div>

      <!-- Mode Toggle -->
      <div class="mode-toggle-section">
        <div class="mode-toggle__label">Mode</div>
        <div class="mode-toggle__buttons">
          <AppButton
            label="AUTO"
            :severity="mode === 'auto' ? 'success' : 'secondary'"
            :raised="mode === 'auto'"
            size="sm"
            @click="onModeChange('auto')"
            :disabled="forcing"
          />
          <AppButton
            label="MANUAL"
            :severity="mode === 'manual' ? 'warning' : 'secondary'"
            :raised="mode === 'manual'"
            size="sm"
            @click="onModeChange('manual')"
            :disabled="forcing"
          />
        </div>
        <span class="mode-toggle__hint" v-if="mode === 'manual'">
          Pedestrian detection ignored. Use buttons below to control signals.
        </span>
        <span class="mode-toggle__hint" v-else>
          Pedestrian detection active. Signals change automatically when a pedestrian is detected.
        </span>
      </div>

      <!-- Manual Override -->
      <div class="override-actions">
        <AppButton
          label="Red"
          severity="danger"
          size="sm"
          icon="pi pi-stop-circle"
          :loading="forcing"
          :disabled="status?.state === 'RED'"
          @click="forceWithDuration('RED')"
        />
        <AppButton
          label="Yellow"
          severity="warning"
          size="sm"
          icon="pi pi-pause-circle"
          :loading="forcing"
          :disabled="status?.state === 'YELLOW'"
          @click="forceWithDuration('YELLOW')"
        />
        <AppButton
          label="Green"
          severity="success"
          size="sm"
          icon="pi pi-play-circle"
          :loading="forcing"
          :disabled="status?.state === 'GREEN'"
          @click="forceWithDuration('GREEN')"
        />
      </div>

      <!-- Custom Duration Input (for manual mode) -->
      <div v-if="mode === 'manual'" class="custom-duration-section">
        <label class="custom-duration__label">Custom Duration (ms)</label>
        <div class="custom-duration__input-group">
          <AppInput
            v-model="customDuration"
            type="number"
            placeholder="e.g. 30000"
            min="1000"
            max="3600000"
            style="width: 120px"
          />
          <span class="custom-duration__hint">Leave empty for default timer</span>
        </div>
      </div>

      <!-- Manual Timers Configuration -->
      <div v-if="mode === 'manual'" class="manual-timers-section">
        <div class="manual-timers__header">
          <span class="manual-timers__title">Manual Timers (persisted)</span>
          <AppButton
            label="Save Timers"
            severity="primary"
            size="sm"
            :loading="savingTimers"
            @click="saveManualTimers"
          />
        </div>
        <div class="manual-timers__grid">
          <div class="manual-timers__item">
            <label class="manual-timers__label">Green (Go)</label>
            <AppInput
              v-model="manualGreenMs"
              type="number"
              min="1000"
              max="3600000"
              :step="1000"
            />
            <span class="manual-timers__unit">ms</span>
          </div>
          <div class="manual-timers__item">
            <label class="manual-timers__label">Yellow (Caution)</label>
            <AppInput
              v-model="manualYellowMs"
              type="number"
              min="1000"
              max="60000"
              :step="1000"
            />
            <span class="manual-timers__unit">ms</span>
          </div>
          <div class="manual-timers__item">
            <label class="manual-timers__label">Red (Stop)</label>
            <AppInput
              v-model="manualRedMs"
              type="number"
              min="1000"
              max="3600000"
              :step="1000"
            />
            <span class="manual-timers__unit">ms</span>
          </div>
          <div class="manual-timers__item">
            <label class="manual-timers__label">Ped Walk</label>
            <AppInput
              v-model="manualPedWalkMs"
              type="number"
              min="1000"
              max="3600000"
              :step="1000"
            />
            <span class="manual-timers__unit">ms</span>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="muted mt-2">Loading signal state…</p>
  </AppCard>
</template>

<style scoped>
.signal-display { display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3); }
.signal-display__light { width:24px; height:24px; border-radius:50%; flex-shrink:0; }
.signal-display__light--green { background:var(--c-success); box-shadow:0 0 8px var(--c-success); }
.signal-display__light--yellow { background:var(--c-warning); box-shadow:0 0 8px var(--c-warning); }
.signal-display__light--red { background:var(--c-danger); box-shadow:0 0 8px var(--c-danger); }
.signal-display__label { font-weight:600; font-size:var(--fs-base); }
.signal-display__meta { font-size:var(--fs-xs); color:var(--c-text-muted); }
.override-actions { display:flex; gap:var(--space-2); flex-wrap:wrap; margin-bottom: var(--space-3); }
.muted { color:var(--c-text-muted); font-size:var(--fs-sm); }

/* Mode Toggle */
.mode-toggle-section {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}
.mode-toggle__label { font-weight: 600; font-size: var(--fs-sm); margin-bottom: var(--space-2); }
.mode-toggle__buttons { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
.mode-toggle__hint { font-size: var(--fs-xs); color: var(--c-text-muted); }

/* Custom Duration */
.custom-duration-section {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}
.custom-duration__label { font-weight: 600; font-size: var(--fs-sm); display: block; margin-bottom: var(--space-2); }
.custom-duration__input-group { display: flex; align-items: center; gap: var(--space-2); }
.custom-duration__hint { font-size: var(--fs-xs); color: var(--c-text-muted); }

/* Manual Timers */
.manual-timers-section {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
.manual-timers__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.manual-timers__title { font-weight: 600; font-size: var(--fs-sm); }
.manual-timers__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
.manual-timers__item { display: flex; flex-direction: column; gap: var(--space-1); }
.manual-timers__label { font-size: var(--fs-xs); color: var(--c-text-muted); font-weight: 500; }
.manual-timers__item .p-inputtext { width: 100%; }
.manual-timers__unit { font-size: var(--fs-xs); color: var(--c-text-muted); }
</style>