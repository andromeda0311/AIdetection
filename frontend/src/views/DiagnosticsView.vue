<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue';
import { getLiveSystemStatus } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import type { LiveSystemState } from '@/types';
import AppButton from '@/components/ui/AppButton.vue';
const { liveState, connected } = inject<{ liveState: Ref<LiveSystemState | null>; connected: Ref<boolean> }>('operationsState')!;
const busy = ref(false);
const error = ref('');
const lastCheck = ref('Not checked');
const modules = computed(() => [
  { label: 'Signal controller', icon: 'pi pi-microchip', status: connected.value ? liveState.value?.arduino : 'offline', detail: 'Traffic signal command interface', fields: [['Traffic phase', connected.value ? liveState.value?.traffic ?? 'Unavailable' : 'Unavailable'], ['Operating mode', connected.value ? liveState.value?.mode ?? 'Unavailable' : 'Unavailable']] },
  { label: 'Countdown timers', icon: 'pi pi-clock', status: connected.value ? 'online' : 'offline', detail: 'Live cycle timing and clearance', fields: [['Vehicle timer', connected.value && liveState.value?.carTimer != null ? liveState.value.carTimer + ' sec' : 'Unavailable'], ['Pedestrian timer', connected.value && liveState.value?.pedTimer != null ? liveState.value.pedTimer + ' sec' : 'Unavailable']] },
  { label: 'Camera input', icon: 'pi pi-video', status: connected.value ? liveState.value?.camera : 'offline', detail: 'Camera stream and frame dimensions', fields: [['Frame size', connected.value && liveState.value?.frameWidth ? liveState.value.frameWidth + ' × ' + liveState.value.frameHeight : 'Unavailable'], ['Camera count', connected.value ? String(liveState.value?.cameras?.length ?? 0) : 'Unavailable']] },
  { label: 'Detection engine', icon: 'pi pi-eye', status: connected.value ? liveState.value?.yolo : 'offline', detail: 'Person presence and confidence', fields: [['People in frame', connected.value && liveState.value?.yolo === 'online' ? String(liveState.value.pedestrianCount) : 'Unavailable'], ['Confidence', connected.value && liveState.value?.yolo === 'online' ? Math.round(liveState.value.confidence * 100) + '%' : 'Unavailable']] },
]);
async function refresh() {
  busy.value = true; error.value = '';
  try { liveState.value = await getLiveSystemStatus(); lastCheck.value = new Date().toLocaleTimeString(); }
  catch (e) { error.value = getErrorMessage(e); }
  finally { busy.value = false; }
}
function download() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ checkedAt: new Date().toISOString(), connected: connected.value, state: liveState.value }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'crosswalk-diagnostics.json'; link.click(); URL.revokeObjectURL(url);
}
</script>
<template>
  <div class="ops-page">
    <header class="ops-page-heading"><div><p class="ops-eyebrow">Node hardware registry / Diagnostics</p><h2>Hardware telemetry &amp; component status</h2><p>Connection health and the latest reported device state.</p></div><AppButton variant="secondary" @click="download"><i class="pi pi-download" />Export diagnostics</AppButton></header>
    <section class="ops-panel"><div class="ops-panel__body controller-summary"><span class="diagnostic-chip"><i class="pi pi-microchip" /></span><div><h3>Crosswalk signal controller</h3><span class="ops-tag" :class="{ 'ops-tag--green': connected }">{{ connected ? 'Telemetry connected' : 'Controller unavailable' }}</span><p class="ops-help mono">Last manual check: {{ lastCheck }}</p></div><AppButton :loading="busy" @click="refresh"><i class="pi pi-refresh" />Refresh controller status</AppButton></div></section>
    <p v-if="error" class="ops-error" role="alert">{{ error }}</p>
    <div class="diagnostic-modules"><section v-for="(module, index) in modules" :key="module.label" class="ops-panel"><header class="ops-panel__header"><h2><i :class="module.icon" />{{ String(index + 1).padStart(2, '0') }} / {{ module.label }}</h2><span class="ops-tag" :class="{ 'ops-tag--green': module.status === 'online' }">{{ module.status ?? 'unknown' }}</span></header><div class="ops-panel__body"><p class="ops-help">{{ module.detail }}</p><dl class="diagnostic-fields"><template v-for="field in module.fields" :key="field[0]"><dt>{{ field[0] }}</dt><dd class="mono">{{ field[1] }}</dd></template></dl></div></section></div>
    <section class="ops-panel"><header class="ops-panel__header"><h2><i class="pi pi-code" />Latest telemetry payload</h2><span class="ops-tag">{{ connected ? 'Live state' : 'No active connection' }}</span></header><pre class="ops-json">{{ liveState ? JSON.stringify(liveState, null, 2) : 'No telemetry received. Connect the API and signal controller to inspect device data.' }}</pre></section>
  </div>
</template>
<style scoped>
.controller-summary { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
.controller-summary h3 { margin:0 0 12px; font-size:18px; }
.controller-summary > .btn { margin-left:auto; }
.diagnostic-chip { display:grid; place-items:center; width:65px; height:65px; background:var(--ops-inset); color:var(--ops-cyan); border-radius:10px; font-size:27px; }
.diagnostic-modules { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:16px; }
.diagnostic-modules h2 { font-size:11px; }
.diagnostic-modules .ops-panel__header { align-items:flex-start; flex-wrap:wrap; }
.diagnostic-fields { display:grid; gap:12px; margin:20px 0 0; }
.diagnostic-fields dt { color:var(--c-text-muted); font-size:10px; text-transform:uppercase; }
.diagnostic-fields dd { margin:0 0 14px; font-size:13px; color:var(--ops-cyan); }
.ops-error { margin:0; padding:14px; background:var(--ops-inset); border-left:3px solid var(--c-danger); color:var(--c-danger); font-size:12px; }
@media(max-width:1200px) { .diagnostic-modules { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:600px) { .diagnostic-modules { grid-template-columns:1fr; } }
</style>
