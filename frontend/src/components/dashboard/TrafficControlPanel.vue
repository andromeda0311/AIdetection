<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { forcePhase } from '@/api';
import { getErrorMessage } from '@/api/client';
import type { LiveSystemState } from '@/types';
const props = defineProps<{ state: LiveSystemState | null; connected: boolean }>();
const busy = ref(false);
const toast = useToast();
const phase = computed(() => !props.connected ? 'unknown' : props.state?.traffic ?? 'unknown');
async function force(value: 'GREEN' | 'YELLOW' | 'RED') {
  busy.value = true;
  try { await forcePhase(value); toast.add({ severity: 'success', summary: 'Signal command sent', detail: value, life: 2500 }); }
  catch (error) { toast.add({ severity: 'error', summary: 'Signal command failed', detail: getErrorMessage(error), life: 3000 }); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="ops-panel">
    <header class="ops-panel__header"><div><h2><i class="pi pi-sliders-h" aria-hidden="true" />Direct traffic controls</h2><p>Manual phase triggers &amp; cycle override</p></div></header>
    <div class="ops-panel__body">
      <div class="traffic-indicator"><div class="traffic-lamps" aria-label="Traffic signal"><span class="lamp red" :class="{ lit: phase === 'stopped' }" /><span class="lamp amber" :class="{ lit: phase === 'caution' }" /><span class="lamp green" :class="{ lit: phase === 'normal' }" /></div><strong :class="'signal-' + phase">{{ phase === 'normal' ? 'Green / Flow' : phase === 'caution' ? 'Amber / Caution' : phase === 'stopped' ? 'Red / Stop' : 'Signal unavailable' }}</strong><span class="mono">{{ connected ? state?.mode ?? '—' : 'Offline' }}</span></div>
      <div class="phase-controls">
        <button class="phase-button green" :disabled="!connected || busy" @click="force('GREEN')"><span class="status-led" />Green flow<small>Cars go</small></button>
        <button class="phase-button amber" :disabled="!connected || busy" @click="force('YELLOW')"><span class="status-led" />Amber caution<small>Clear interval</small></button>
        <button class="phase-button red" :disabled="!connected || busy" @click="force('RED')"><span class="status-led" />Pedestrian walk<small>Red / Stop</small></button>
      </div>
      <p v-if="!connected" class="ops-help">Connect the controller to enable signal commands.</p>
    </div>
  </section>
</template>
