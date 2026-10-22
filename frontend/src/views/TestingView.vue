<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue';
import { getLiveSystemStatus } from '@/api/live';
import { forcePhase, triggerManualCycle } from '@/api';
import { getErrorMessage } from '@/api/client';
import type { LiveSystemState } from '@/types';
import AppButton from '@/components/ui/AppButton.vue';
const { liveState, connected } = inject<{ liveState: Ref<LiveSystemState | null>; connected: Ref<boolean> }>('operationsState')!;
const busy = ref(false); const active = ref('No test in progress');
const results = ref<Array<{ timestamp: string; routine: string; result: string; detail: string }>>([]);
const cycleSeconds = computed(() => liveState.value?.manualTimers ? (liveState.value.manualTimers.greenMs + liveState.value.manualTimers.yellowMs + liveState.value.manualTimers.redMs) / 1000 : null);
async function run(kind: 'status' | 'cycle' | 'walk') {
  busy.value = true;
  const label = kind === 'status' ? 'Connection check' : kind === 'cycle' ? 'Full cycle command' : 'Red phase command';
  active.value = label;
  try {
    let detail = 'Controller accepted the command. Confirm physical signals at the installation.';
    if (kind === 'status') { const state = await getLiveSystemStatus(); liveState.value = state; detail = 'Camera: ' + state.camera + '; Detection: ' + state.yolo + '; Controller: ' + state.arduino; }
    else if (kind === 'cycle') await triggerManualCycle();
    else await forcePhase('RED');
    results.value.unshift({ timestamp: new Date().toISOString(), routine: label, result: kind === 'status' ? 'Checked' : 'Accepted', detail });
  } catch (error) { results.value.unshift({ timestamp: new Date().toISOString(), routine: label, result: 'Failed', detail: getErrorMessage(error) }); }
  finally { busy.value = false; active.value = 'No test in progress'; }
}
function exportResults() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(results.value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'crosswalk-test-session.json'; a.click(); URL.revokeObjectURL(url);
}
</script>
<template>
  <div class="ops-page">
    <header class="ops-page-heading"><div><p class="ops-eyebrow">Controller test harness / Operator validation</p><h2>Test routines &amp; diagnostic validation</h2><p>Check reported connections and request supported signal routines.</p></div><span class="ops-tag" :class="{ 'ops-tag--green': connected }">{{ connected ? 'Controller connected' : 'Controller offline' }}</span></header>
    <section class="ops-panel"><div class="routine-status"><i class="pi pi-play-circle" /><div><span class="ops-eyebrow">Routine status</span><strong>{{ active }}</strong></div><span class="ops-tag">{{ busy ? 'Request in progress' : 'Idle' }}</span></div></section>
    <div class="ops-grid-3">
      <section class="ops-panel scenario-card"><div class="ops-panel__body"><p class="ops-eyebrow">Scenario 01 / Read-only</p><h3>Connection check</h3><p class="ops-help">Fetch the latest camera, detector, and signal controller statuses. No traffic phase is changed.</p><div class="ops-inset mono">API response / Module health</div><AppButton block :loading="busy && active === 'Connection check'" :disabled="busy" @click="run('status')"><i class="pi pi-bolt" />Run connection check</AppButton></div></section>
      <section class="ops-panel scenario-card cyan"><div class="ops-panel__body"><p class="ops-eyebrow">Scenario 02 / Signal routine</p><h3>Full cycle routine</h3><p class="ops-help">Request the configured green, amber, and red sequence. This command affects connected physical lights.</p><div class="ops-inset mono">{{ cycleSeconds != null ? cycleSeconds + ' sec / Configured cycle' : 'Cycle timing unavailable' }}</div><AppButton variant="secondary" block :disabled="!connected || busy" @click="run('cycle')"><i class="pi pi-sync" />Execute full cycle</AppButton></div></section>
      <section class="ops-panel scenario-card green"><div class="ops-panel__body"><p class="ops-eyebrow">Scenario 03 / Phase command</p><h3>Pedestrian stop phase</h3><p class="ops-help">Request a red traffic phase using the existing controller endpoint. Confirm the physical response separately.</p><div class="ops-inset mono">Traffic red / Controller command</div><AppButton variant="secondary" block :disabled="!connected || busy" @click="run('walk')"><i class="pi pi-user" />Request red phase</AppButton></div></section>
    </div>
    <section class="ops-panel"><header class="ops-panel__header"><div><h2><i class="pi pi-list" />Diagnostic &amp; test session log</h2><p>Results from this browser session. Command acceptance is not physical validation.</p></div><AppButton variant="secondary" size="sm" :disabled="!results.length" @click="exportResults"><i class="pi pi-download" />Export JSON</AppButton></header><div v-if="results.length" class="ops-table-scroll"><table class="ops-table"><thead><tr><th>Timestamp</th><th>Routine</th><th>Response</th><th>Details</th></tr></thead><tbody><tr v-for="(result, index) in results" :key="index"><td class="mono">{{ result.timestamp }}</td><td>{{ result.routine }}</td><td><span class="ops-tag" :class="{ 'ops-tag--green': result.result !== 'Failed' }">{{ result.result }}</span></td><td>{{ result.detail }}</td></tr></tbody></table></div><div v-else class="ops-empty"><i class="pi pi-inbox" />No routines have been run in this session.</div></section>
  </div>
</template>
<style scoped>
.routine-status { display:flex; align-items:center; gap:16px; padding:20px; }
.routine-status > i { font-size:24px; color:var(--ops-cyan); }
.routine-status > div { flex:1; display:grid; gap:6px; }
.routine-status .ops-eyebrow { margin:0; }
.routine-status strong { font-size:14px; }
.scenario-card { border-top:3px solid #b4c5ff; }
.scenario-card.cyan { border-top-color:#4cd7f6; }
.scenario-card.green { border-top-color:#4edea3; }
.scenario-card h3 { font-size:20px; margin:16px 0; }
.scenario-card .ops-panel__body { display:flex; flex-direction:column; height:100%; }
.scenario-card .ops-help { flex:1; margin-bottom:24px; }
.scenario-card .ops-inset { font-size:11px; margin-bottom:22px; }
</style>
