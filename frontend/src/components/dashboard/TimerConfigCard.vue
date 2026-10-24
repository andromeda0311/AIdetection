<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getSignalConfig, updateSignalConfig, type SignalConfig } from '@/api';
import { useToast } from 'primevue/usetoast';
import { getErrorMessage } from '@/api/client';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppCard from '@/components/ui/AppCard.vue';

const toast = useToast();
const loading = ref(false);
const saving = ref(false);
const config = ref<SignalConfig>({ detectionThresholdMs: 5000, yellowMs: 3000, redMs: 20000, mode: 'auto', manualGreenMs: null, manualYellowMs: null, manualRedMs: null, manualPedWalkMs: null });
const edit = ref(false);

async function load() {
  loading.value = true;
  try {
    config.value = await getSignalConfig();
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Load failed', detail: getErrorMessage(err), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    // Only the automatic timings are sent; the other columns keep their values.
    config.value = await updateSignalConfig({ yellowMs: config.value.yellowMs, redMs: config.value.redMs });
    edit.value = false;
    toast.add({ severity: 'success', summary: 'Saved', detail: 'Signal timers updated', life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: getErrorMessage(err), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function cancel() {
  load();
  edit.value = false;
}

onMounted(load);
</script>

<template>
  <AppCard title="Signal Timers" subtitle="Configure yellow & red durations (ms)">
    <template v-if="loading">
      <div class="flex-center" style="height:80px;">
        <div class="spinner" role="status" aria-label="Loading timers" />
      </div>
    </template>
    <template v-else>
      <div v-if="!edit" class="timer-view">
        <div class="timer-row">
          <span class="timer-label">Yellow</span>
          <span class="timer-value">{{ config.yellowMs }} ms</span>
        </div>
        <div class="timer-row">
          <span class="timer-label">Red</span>
          <span class="timer-value">{{ config.redMs }} ms</span>
        </div>
        <AppButton label="Edit" icon="pi pi-pencil" @click="edit = true" />
      </div>

      <div v-else class="timer-edit">
        <div class="field">
          <label for="yellow">Yellow (ms)</label>
          <AppInput id="yellow" v-model.number="config.yellowMs" type="number" min="500" step="100" />
        </div>
        <div class="field">
          <label for="red">Red (ms)</label>
          <AppInput id="red" v-model.number="config.redMs" type="number" min="1000" step="1000" />
        </div>
        <div class="actions">
          <AppButton label="Cancel" variant="secondary" @click="cancel" />
          <AppButton label="Save" :loading="saving" @click="save" />
        </div>
      </div>
    </template>
  </AppCard>
</template>

<style scoped>
.timer-view { display:flex; flex-direction:column; gap:var(--space-3); align-items:flex-start; }
.timer-row { display:flex; align-items:center; gap:var(--space-3); font-size:var(--fs-md); }
.timer-label { color:var(--c-text-muted); min-width:80px; }
.timer-value { font-weight:600; color:var(--c-text); }
.timer-edit { display:flex; flex-direction:column; gap:var(--space-3); }
.field { display:flex; flex-direction:column; gap:var(--space-1); }
.field label { font-size:var(--fs-sm); color:var(--c-text-muted); }
.actions { display:flex; gap:var(--space-2); margin-top:var(--space-2); }
</style>