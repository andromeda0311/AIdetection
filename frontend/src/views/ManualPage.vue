<script setup lang="ts">
import { onMounted, watch, ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useLiveSystemState } from '@/composables/useLiveSystemState';
import { getManualTimers, setManualTimers, getSignalMode, setSignalMode, forcePhase, triggerManualCycle } from '@/api';
import ModeToggleCard from '@/components/dashboard/ModeToggleCard.vue';
import SignalTimersConfigCard from '@/components/dashboard/SignalTimersConfigCard.vue';
import TelemetryStatusCard from '@/components/dashboard/TelemetryStatusCard.vue';
import DirectControlsCard from '@/components/dashboard/DirectControlsCard.vue';
import { getErrorMessage } from '@/api/client';

const toast = useToast();
const { liveState, connected } = useLiveSystemState();

// Manual config state - sync with server
const greenDurationSec = ref(30);
const yellowDurationSec = ref(3);
const redDurationSec = ref(20);

const modeLoading = ref(false);

const isManualMode = computed(() => liveState.value?.mode === 'manual');
const currentTrafficState = computed(() => connected.value ? liveState.value?.traffic?.toUpperCase() ?? 'UNAVAILABLE' : 'UNAVAILABLE');
const cyclePhase = computed(() => connected.value ? liveState.value?.cyclePhase ?? 'IDLE' : 'UNAVAILABLE');
const cycleRemainingSec = computed(() => liveState.value?.cycleRemainingSec ?? 0);
const autoStopSec = computed(() => liveState.value?.autoStopSec ?? redDurationSec.value);

// Sync manual timers from server on mount
onMounted(async () => {
  try {
    const [timers, modeRes] = await Promise.all([
      getManualTimers(),
      getSignalMode(),
    ]);
    greenDurationSec.value = timers.greenMs / 1000;
    yellowDurationSec.value = timers.yellowMs / 1000;
    redDurationSec.value = timers.redMs / 1000;
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: getErrorMessage(err), life: 3000 });
  }
});

// Watch for server-side timer changes
watch(
  () => liveState.value?.manualTimers,
  (timers) => {
    if (timers) {
      greenDurationSec.value = timers.greenMs / 1000;
      yellowDurationSec.value = timers.yellowMs / 1000;
      redDurationSec.value = timers.redMs / 1000;
    }
  },
  { deep: true }
);

async function toggleMode(newMode: 'manual' | 'auto') {
  modeLoading.value = true;
  try {
    await setSignalMode(newMode);
    toast.add({ severity: 'success', summary: 'Mode updated', detail: `Mode set to ${newMode.toUpperCase()}`, life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: getErrorMessage(err), life: 3000 });
  } finally {
    modeLoading.value = false;
  }
}

// Manual trigger action
async function press(phase: 'GREEN' | 'YELLOW' | 'RED') {
  try {
    await forcePhase(phase);
    toast.add({ severity: 'success', summary: 'Signal Forced', detail: `Signal switched to ${phase}`, life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Override Failed', detail: getErrorMessage(err), life: 3000 });
  }
}

// Run Full Automated Cycle
async function runFullCycle() {
  modeLoading.value = true;
  try {
    await triggerManualCycle();
    toast.add({ severity: 'success', summary: 'Manual Cycle Started', detail: `Running ${greenDurationSec.value}s Green → ${yellowDurationSec.value}s Yellow → ${redDurationSec.value}s Red cycle`, life: 3500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Cycle Failed', detail: getErrorMessage(err), life: 3000 });
  } finally {
    modeLoading.value = false;
  }
}

// Save config to backend (red stop duration also applies to the auto detection cycle)
async function saveConfig(timers: { greenMs: number; yellowMs: number; redMs: number }) {
  modeLoading.value = true;
  try {
    await setManualTimers(timers);
    toast.add({ severity: 'success', summary: 'Config saved', detail: 'Durations updated', life: 3000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Failed', detail: getErrorMessage(err), life: 3000 });
  } finally {
    modeLoading.value = false;
  }
}

// Reset config to defaults
async function resetConfig() {
  if (confirm('Reset all durations to default values (30s green, 3s yellow, 20s red)?')) {
    modeLoading.value = true;
    try {
      await setManualTimers({ greenMs: 30000, yellowMs: 3000, redMs: 20000 });
      greenDurationSec.value = 30;
      yellowDurationSec.value = 3;
      redDurationSec.value = 20;
      toast.add({ severity: 'success', summary: 'Config reset', detail: 'Durations reset to defaults', life: 3000 });
    } catch (err) {
      toast.add({ severity: 'error', summary: 'Failed', detail: getErrorMessage(err), life: 3000 });
    } finally {
      modeLoading.value = false;
    }
  }
}
</script>

<template>
  <div class="manual-page">
    <header class="page-header">
      <div>
        <p class="ops-eyebrow">Operator console / Signal arbitration</p>
        <h1 class="page-title">Manual control &amp; signal override</h1>
        <p class="page-subtitle">Configure signal durations and override crosswalk state directly</p>
      </div>

      <ModeToggleCard :is-manual-mode="isManualMode" :loading="modeLoading || !connected" @change="toggleMode" />
    </header>

    <p v-if="!connected" class="ops-help">Controller offline. Signal commands are unavailable until a connection is established.</p>

    <div class="manual-grid">
      <SignalTimersConfigCard
        :green-sec="greenDurationSec"
        :yellow-sec="yellowDurationSec"
        :red-sec="redDurationSec"
        :saving="modeLoading"
        @save="saveConfig"
        @reset="resetConfig"
      />

      <TelemetryStatusCard
        :mode="connected ? liveState?.mode : undefined"
        :traffic="currentTrafficState"
        :cycle-phase="cyclePhase"
        :cycle-remaining-sec="cycleRemainingSec"
        :auto-stop-sec="autoStopSec"
      />
    </div>

    <DirectControlsCard
      class="controls-card"
      :green-sec="greenDurationSec"
      :yellow-sec="yellowDurationSec"
      :red-sec="redDurationSec"
      :busy="modeLoading || !connected"
      @run-cycle="runFullCycle"
      @press="press"
    />
  </div>
</template>

<style scoped>
.manual-page {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--c-border);
}

.page-title {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--c-text-primary);
}

.page-subtitle {
  margin-top: var(--space-1);
  color: var(--c-text-secondary);
  font-size: var(--fs-sm);
}

.manual-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: var(--space-5);
  align-items: start;
}

.controls-card {
  margin-top: var(--space-4);
}

@media (max-width: 900px) {
  .manual-grid {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
}
</style>
