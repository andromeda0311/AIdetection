<script setup lang="ts">
import { ref, watch } from 'vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';

const props = defineProps<{
  greenSec: number;
  yellowSec: number;
  redSec: number;
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [timers: { greenMs: number; yellowMs: number; redMs: number }];
  reset: [];
}>();

const edit = ref(false);

const green = ref(props.greenSec);
const yellow = ref(props.yellowSec);
const red = ref(props.redSec);

watch(
  () => [props.greenSec, props.yellowSec, props.redSec] as const,
  ([g, y, r]) => {
    green.value = g;
    yellow.value = y;
    red.value = r;
  },
);

function onSave() {
  emit('save', {
    greenMs: Number(green.value) * 1000,
    yellowMs: Number(yellow.value) * 1000,
    redMs: Number(red.value) * 1000,
  });
  edit.value = false;
}

function onCancel() {
  green.value = props.greenSec;
  yellow.value = props.yellowSec;
  red.value = props.redSec;
  edit.value = false;
}

function onReset() {
  emit('reset');
  edit.value = false;
}
</script>

<template>
  <AppCard
    title="Signal Timers Config"
    subtitle="Set Green, Yellow, and Red durations — the Red (Stop) duration applies to both manual override and the auto detection cycle"
    bordered
  >
    <template v-if="!edit">
      <div class="timer-view">
        <div class="timer-row">
          <span class="timer-dot dot-green" />
          <span class="timer-label">Green Light (Go)</span>
          <span class="timer-value">{{ greenSec }}s</span>
        </div>
        <div class="timer-row">
          <span class="timer-dot dot-yellow" />
          <span class="timer-label">Yellow Light (Caution)</span>
          <span class="timer-value">{{ yellowSec }}s</span>
        </div>
        <div class="timer-row">
          <span class="timer-dot dot-red" />
          <span class="timer-label">Red Light (Stop)</span>
          <span class="timer-value">{{ redSec }}s</span>
        </div>
        <AppButton size="sm" variant="secondary" @click="edit = true">Edit</AppButton>
      </div>
    </template>

    <template v-else>
      <div class="config-fields">
        <div class="field-row">
          <label class="field-label" for="timer-green">Green Light (Go)</label>
          <AppInput id="timer-green" v-model.number="green" type="number" :min="5" :max="300" step="1" />
          <span class="field-unit">seconds</span>
        </div>
        <div class="field-row">
          <label class="field-label" for="timer-yellow">Yellow Light (Caution)</label>
          <AppInput id="timer-yellow" v-model.number="yellow" type="number" :min="1" :max="60" step="1" />
          <span class="field-unit">seconds</span>
        </div>
        <div class="field-row">
          <label class="field-label" for="timer-red">Red Light (Stop)</label>
          <AppInput id="timer-red" v-model.number="red" type="number" :min="5" :max="300" step="1" />
          <span class="field-unit">seconds</span>
        </div>
      </div>
      <div class="footer-actions">
        <AppButton size="sm" variant="ghost" :disabled="saving" @click="onCancel">Cancel</AppButton>
        <AppButton size="sm" variant="secondary" :disabled="saving" @click="onReset">Reset Defaults</AppButton>
        <AppButton size="sm" :loading="saving" @click="onSave">Save Config</AppButton>
      </div>
    </template>
  </AppCard>
</template>

<style scoped>
.timer-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.timer-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--fs-sm);
  width: 100%;
}

.timer-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green { background: #22c55e; }
.dot-yellow { background: #f59e0b; }
.dot-red { background: #ef4444; }

.timer-label {
  color: var(--c-text-secondary, var(--c-text));
  flex: 1;
}

.timer-value {
  font-weight: 700;
  color: var(--c-text);
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-2) 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.field-label {
  min-width: 160px;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text);
}

.field-unit {
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--c-border);
}

@media (max-width: 640px) {
  .field-row {
    flex-direction: column;
    align-items: stretch;
  }

  .field-label {
    min-width: 0;
  }
}
</style>
