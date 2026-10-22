<script setup lang="ts">
import { computed } from 'vue';
import AppCard from '@/components/ui/AppCard.vue';

const props = defineProps<{
  mode: 'auto' | 'manual' | undefined;
  traffic: string;
  cyclePhase: string;
  cycleRemainingSec: number;
  autoStopSec: number;
}>();

const modeLabel = computed(() => props.mode === undefined ? 'UNAVAILABLE' : props.mode === 'manual' ? 'MANUAL OVERRIDE' : 'AUTO DETECT');

const countdown = computed(() =>
  props.cycleRemainingSec > 0 ? `${props.cycleRemainingSec.toString().padStart(2, '0')}s` : null,
);

const stopDuration = computed(() => `${props.autoStopSec}s`);
</script>

<template>
  <AppCard title="Current Status & Telemetry" bordered>
    <div class="status-metrics">
      <div class="metric-item">
        <span class="metric-label">Operating Mode</span>
        <span class="metric-badge" :class="mode === 'manual' ? 'badge-manual' : 'badge-auto'">
          {{ modeLabel }}
        </span>
      </div>

      <div class="metric-item">
        <span class="metric-label">Active Signal</span>
        <span class="metric-value" :class="`signal-${traffic.toLowerCase()}`">{{ traffic }}</span>
      </div>

      <div class="metric-item">
        <span class="metric-label">Cycle Phase</span>
        <span class="metric-value">{{ cyclePhase }}</span>
      </div>

      <div class="metric-item">
        <span class="metric-label">Auto Stop Duration</span>
        <span class="metric-value">{{ stopDuration }}</span>
      </div>

      <div v-if="countdown" class="metric-item">
        <span class="metric-label">Remaining Time</span>
        <span class="timer-value seven-seg">{{ countdown }}</span>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.status-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--c-border);
}

.metric-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.metric-label {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}

.metric-badge {
  padding: 4px 10px;
  border-radius: var(--radius-full, 999px);
  font-size: var(--fs-xs, var(--fs-sm));
  font-weight: 700;
}

.badge-manual {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid #f59e0b;
}

.badge-auto {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid #22c55e;
}

.signal-normal,
.signal-green {
  color: #22c55e;
  font-weight: 700;
}

.signal-caution,
.signal-yellow {
  color: #f59e0b;
  font-weight: 700;
}

.signal-stopped,
.signal-red {
  color: #ef4444;
  font-weight: 700;
}

.timer-value {
  font-weight: 700;
}

.seven-seg {
  font-family: 'DSEG7 Classic', 'Courier New', monospace;
  background: #000;
  color: #00ff00;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
}
</style>
