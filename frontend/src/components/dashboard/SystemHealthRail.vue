<script setup lang="ts">
import { computed } from 'vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import type { LiveSystemState } from '@/types';

defineProps<{
  liveState: LiveSystemState | null;
}>();

function serviceSeverity(value: 'online' | 'offline' | undefined): 'success' | 'danger' {
  return value === 'online' ? 'success' : 'danger';
}

function trafficSeverity(traffic: LiveSystemState['traffic'] | undefined): 'danger' | 'warning' | 'success' {
  if (traffic === 'stopped') return 'danger';
  if (traffic === 'caution') return 'warning';
  return 'success';
}

function trafficLabel(traffic: LiveSystemState['traffic'] | undefined) {
  if (traffic === 'stopped') return 'Stopped';
  if (traffic === 'caution') return 'Caution';
  return 'Normal';
}
</script>

<template>
  <AppCard title="System Health" subtitle="Service connectivity and traffic control state" padding="sm">
    <template v-if="liveState">
      <div class="service-status-list">
        <div class="service-status-row">
          <span class="service-status-row__label">YOLO Service</span>
          <AppBadge :severity="serviceSeverity(liveState.yolo)">{{ liveState.yolo }}</AppBadge>
        </div>
        <div class="service-status-row">
          <span class="service-status-row__label">Camera</span>
          <AppBadge :severity="serviceSeverity(liveState.camera)">{{ liveState.camera }}</AppBadge>
        </div>
        <div class="service-status-row">
          <span class="service-status-row__label">Arduino</span>
          <AppBadge :severity="serviceSeverity(liveState.arduino)">{{ liveState.arduino }}</AppBadge>
        </div>
        <div class="service-status-row">
          <span class="service-status-row__label">Traffic</span>
          <AppBadge :severity="trafficSeverity(liveState.traffic)">{{ trafficLabel(liveState.traffic) }}</AppBadge>
        </div>
        <div class="service-status-row">
          <span class="service-status-row__label">Pedestrian</span>
          <AppBadge :severity="liveState.pedestrianDetected ? 'danger' : 'success'">
            {{ liveState.pedestrianDetected ? `${liveState.pedestrianCount} detected` : 'Clear' }}
          </AppBadge>
        </div>
      </div>
      <p v-if="liveState.pedestrianDetected" class="live-hint mt-2">
        Sustained detection for 5 s triggers <strong>yellow (3 s)</strong>, then
        <strong>STOP_TRAFFIC</strong> for 15 s.
      </p>
    </template>
    <p v-else class="muted">Waiting for live system state…</p>
  </AppCard>
</template>

<style scoped>
.service-status-list { display:flex; flex-direction:column; gap:var(--space-2); }
.service-status-row { display:flex; justify-content:space-between; align-items:center; font-size:var(--fs-sm); }
.service-status-row__label { color:var(--c-text-muted); }
.live-hint { font-size:var(--fs-xs); color:var(--c-text-muted); line-height:1.4; }
.muted { color:var(--c-text-muted); font-size:var(--fs-sm); }
</style>