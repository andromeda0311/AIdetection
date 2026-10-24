<script setup lang="ts">
import { inject, onMounted, ref, type Ref } from 'vue';
import { getManualTimers, setManualTimers } from '@/api';
import { getErrorMessage } from '@/api/client';
import type { LiveSystemState } from '@/types';
import SafetyIcon from '@/components/dashboard/SafetyIcon.vue';
import { useSafetySettings } from '@/composables/useSafetySettings';
import { useTheme } from '@/composables/useTheme';
import { useDashboardPreferences } from '@/composables/useDashboardPreferences';
const { dark, toggle } = useTheme();
const { adjustmentsVisible, setAdjustmentsVisible } = useDashboardPreferences();
const {
  settings,
  fields: preferenceFields,
  loading: timingsLoading,
  loadFailed: timingsLoadFailed,
  saving: timingsSaving,
  message: saveMessage,
  messageFailed: saveFailed,
  dirty,
  loadTimings,
  saveSettings,
  resetDefaults,
  discard,
} = useSafetySettings();
onMounted(loadTimings);
const { liveState, connected } = inject<{ liveState: Ref<LiveSystemState | null>; connected: Ref<boolean> }>('operationsState')!;
const green = ref(30); const yellow = ref(3); const red = ref(20);
const loaded = ref(false); const saving = ref(false); const message = ref(''); const failed = ref(false);
const fields = [{ name: 'Vehicle green', model: green, min: 5, max: 300, color: 'green' }, { name: 'Yellow caution', model: yellow, min: 1, max: 60, color: 'amber' }, { name: 'Pedestrian clearance / Red', model: red, min: 5, max: 300, color: 'red' }];
onMounted(async () => {
  try { const timers = await getManualTimers(); green.value = timers.greenMs / 1000; yellow.value = timers.yellowMs / 1000; red.value = timers.redMs / 1000; loaded.value = true; }
  catch { failed.value = true; message.value = 'Controller settings are unavailable. Values below are unsaved defaults.'; }
});
function defaults() { green.value = 30; yellow.value = 3; red.value = 20; message.value = 'Default values restored in this form. Apply to Controller to save them.'; failed.value = false; }
async function save() {
  if (fields.some(f => !Number.isInteger(Number(f.model.value)) || Number(f.model.value) < f.min || Number(f.model.value) > f.max)) { message.value = 'Enter valid durations within the displayed limits.'; failed.value = true; return; }
  saving.value = true;
  try { await setManualTimers({ greenMs: Number(green.value) * 1000, yellowMs: Number(yellow.value) * 1000, redMs: Number(red.value) * 1000 }); loaded.value = true; message.value = 'Signal configuration saved.'; failed.value = false; }
  catch (error) { message.value = getErrorMessage(error); failed.value = true; }
  finally { saving.value = false; }
}
</script> 
<template>
  <div class="safety-settings-page">
    <header class="settings-page-heading">
      <div><RouterLink to="/dashboard" class="settings-back"><SafetyIcon name="back" />Back to dashboard</RouterLink><h2>System Settings</h2><p>Manage monitoring preferences and connected signal timings.</p></div>
      <span class="settings-state">{{ dirty ? 'Unsaved changes' : 'Preferences up to date' }}</span>
    </header>
    <section class="safety-card settings-display-card">
      <header class="safety-card__header"><h2><SafetyIcon name="settings" />Appearance &amp; dashboard</h2></header>
      <div class="settings-display-options">
        <div class="settings-display-option"><div><strong>Dark mode</strong><p>Use the same darker appearance across all screens.</p></div><button type="button" role="switch" :aria-checked="dark" aria-label="Dark mode" class="settings-switch" @click="toggle"><span /></button></div>
        <div class="settings-display-option"><div><strong>Show System Adjustments</strong><p>Display the default timing settings on your dashboard.</p></div><button type="button" role="switch" :aria-checked="adjustmentsVisible" aria-label="Show System Adjustments" class="settings-switch" @click="setAdjustmentsVisible(!adjustmentsVisible)"><span /></button></div>
      </div>
    </section>
    <div class="settings-page-grid">
      <section class="safety-card preferences-card">
        <header class="safety-card__header"><h2><SafetyIcon name="settings" />Automatic cycle timings</h2><span class="settings-scope">Saved on server</span></header>
        <form class="settings-form" @submit.prevent="saveSettings">
          <p class="settings-note"><SafetyIcon name="info" />These timings drive the automatic traffic cycle for every device. The new values apply from the next cycle after saving; manual timers below do not affect the automatic cycle.</p>
          <div class="settings-preference-fields"><div v-for="field in preferenceFields" :key="field.key" class="settings-field">
            <label :for="'preference-' + field.key">{{ field.label }}</label>
            <div class="settings-number"><input :id="'preference-' + field.key" v-model.number="settings[field.key]" type="number" :min="field.min" :max="field.max" step="1" required :disabled="timingsLoading || timingsLoadFailed" :aria-describedby="'preference-help-' + field.key" /><span>seconds</span></div>
            <small :id="'preference-help-' + field.key">{{ field.min }}–{{ field.max }} seconds. {{ field.help }}</small>
          </div></div>
          <div class="settings-actions"><button type="submit" class="save-safety-settings" :disabled="timingsLoadFailed || timingsLoading || timingsSaving || !dirty"><SafetyIcon name="save" />{{ timingsSaving ? 'Saving…' : 'Save Settings' }}</button><button type="button" class="settings-secondary" :disabled="timingsLoadFailed || timingsLoading || timingsSaving || !dirty" @click="discard">Discard changes</button><button type="button" class="settings-reset" :disabled="timingsLoadFailed || timingsLoading" @click="resetDefaults"><SafetyIcon name="reset" />Restore defaults</button></div>
          <p v-if="saveMessage" class="settings-feedback" :class="{ error: saveFailed }" role="status">{{ saveMessage }}</p>
        </form>
      </section>
      <aside class="settings-side-card safety-card">
        <header class="safety-card__header"><h2><SafetyIcon name="nodes" />System connection</h2></header>
        <div class="settings-form"><span class="settings-connection" :class="{ online: connected }"><i />{{ connected ? 'Telemetry online' : 'Awaiting connection' }}</span><dl><dt>Signal controller</dt><dd>{{ connected ? liveState?.arduino ?? 'Unknown' : 'Offline' }}</dd><dt>Operating mode</dt><dd>{{ connected ? liveState?.mode ?? 'Unknown' : 'Unavailable' }}</dd><dt>Detection confirmation</dt><dd>{{ liveState?.thresholdRequiredSec ?? 5 }} seconds</dd></dl><p class="settings-muted">Controller changes require an active connection and a successful response.</p><RouterLink to="/diagnostics" class="settings-back">View diagnostics<SafetyIcon name="arrow" /></RouterLink></div>
      </aside>
      <section class="safety-card settings-controller">
        <header class="safety-card__header"><h2><SafetyIcon name="traffic" />Manual mode timers (test cycles and forced phases only)</h2><span class="settings-scope">{{ loaded ? 'Loaded from controller' : 'Unsaved defaults' }}</span></header>
        <form class="settings-form" @submit.prevent="save">
          <p class="settings-muted">These timers only run the manual test cycles and forced phases; the automatic red time is set under Automatic cycle timings.</p>
          <div class="settings-controller-fields"><div v-for="(field, index) in fields" :key="field.name" class="settings-field"><label :for="'duration-' + index">{{ field.name }}</label><div class="settings-number"><input :id="'duration-' + index" v-model.number="field.model.value" type="number" :min="field.min" :max="field.max" step="1" required /><span>seconds</span></div><small>{{ field.min }}–{{ field.max }} seconds</small></div></div>
          <div class="settings-actions"><button type="submit" class="save-safety-settings" :disabled="!connected || saving"><SafetyIcon name="save" />{{ saving ? 'Applying…' : 'Apply to Controller' }}</button><button type="button" class="settings-reset" @click="defaults"><SafetyIcon name="reset" />Restore defaults</button></div>
          <p v-if="message" class="settings-feedback" :class="{ error: failed }" role="status">{{ message }}</p>
        </form>
      </section>
    </div>
  </div>
</template>
<style scoped>
.safety-settings-page { max-width:1300px; margin:0 auto; padding:6px 0 24px; }
.settings-page-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; }
.settings-page-heading h2 { font-size:27px; margin:14px 0 7px; color:var(--settings-text); letter-spacing:-.6px; }
.settings-page-heading p,.settings-muted { font-size:12px; line-height:1.7; color:var(--settings-muted); }
.settings-back { display:inline-flex; align-items:center; gap:7px; color:var(--settings-link); font-size:12px; font-weight:600; text-decoration:none; margin-top:8px; }
.settings-state,.settings-scope { font-size:10px; color:var(--settings-muted); background:var(--settings-inset); border-radius:6px; padding:7px 10px; }
.settings-page-grid { display:grid; grid-template-columns:minmax(0,2fr) minmax(260px,1fr); gap:20px; align-items:start; }
.settings-controller { grid-column:1 / -1; }
.settings-form { padding:24px; }
.settings-note { display:flex; gap:10px; align-items:flex-start; padding:13px; border-radius:8px; background:var(--settings-inset); color:var(--settings-muted); font-size:11px; line-height:1.7; margin-bottom:24px !important; }
.settings-note .safety-icon { margin-top:2px; }
.settings-preference-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
.settings-controller-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; margin-top:20px; }
.settings-field label { display:block; font-size:11px; font-weight:600; margin-bottom:10px; }
.settings-number { display:flex; align-items:center; border:1px solid var(--settings-border); border-radius:8px; background:var(--settings-input); padding:0 12px; }
.settings-number:focus-within { border-color:var(--settings-link); box-shadow:0 0 0 3px rgb(13 110 158 / 15%); }
.settings-number input { min-width:0; width:100%; padding:12px 0; font:600 21px Inter, sans-serif; color:var(--settings-text); border:0; background:transparent; outline:none; }
.settings-number span,.settings-field small { font-size:10px; color:var(--settings-muted); }
.settings-field small { display:block; margin-top:8px; line-height:1.6; }
.settings-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:24px; padding-top:20px; border-top:1px solid var(--settings-border); }
.settings-actions .save-safety-settings { font-size:11px; padding:11px 15px; }
.settings-secondary,.settings-reset { display:flex; align-items:center; gap:7px; padding:10px 12px; border:1px solid var(--settings-border); border-radius:7px; background:var(--settings-card); color:var(--settings-muted); font-size:11px; cursor:pointer; }
.settings-reset { border:0; margin-left:auto; }
button:disabled { opacity:.5; cursor:not-allowed; }
button:focus-visible,a:focus-visible { outline:3px solid #61b9e1; outline-offset:3px; }
.settings-feedback { font-size:11px; line-height:1.6; margin-top:14px !important; color:var(--settings-success); }
.settings-feedback.error { color:var(--settings-error); }
.settings-connection { display:inline-flex; gap:7px; align-items:center; font-size:11px; padding:8px 11px; border-radius:999px; background:var(--settings-inset); color:var(--settings-muted); }
.settings-connection i { width:6px; height:6px; border-radius:50%; background:#9aabb7; }
.settings-connection.online { background:#e9f8ed; color:#208454; }.settings-connection.online i { background:#2ab06a; }
dl { display:grid; grid-template-columns:1fr auto; gap:17px 12px; margin:25px 0; font-size:11px; }dt { color:var(--settings-muted); }dd { margin:0; font-weight:600; }
@media(max-width:850px) { .settings-page-grid { grid-template-columns:1fr; }.settings-controller { grid-column:auto; }.settings-side-card { order:3; } }
@media(max-width:550px) { .settings-page-heading { align-items:flex-start; flex-direction:column; }.settings-preference-fields,.settings-controller-fields { grid-template-columns:1fr; gap:18px; }.settings-form { padding:18px; }.settings-reset { margin-left:0; }.settings-scope { max-width:130px; text-align:center; } }
.settings-display-card { margin-bottom:20px; }
.settings-display-options { display:grid; grid-template-columns:1fr 1fr; gap:24px; padding:20px 24px; }
.settings-display-option { display:flex; justify-content:space-between; align-items:center; gap:18px; }
.settings-display-option strong { font-size:12px; }
.settings-display-option p { margin-top:6px; color:var(--settings-muted); font-size:10px; line-height:1.6; }
.settings-switch { width:42px; height:24px; padding:3px; flex-shrink:0; border:1px solid var(--settings-border); border-radius:999px; background:var(--settings-switch-off); cursor:pointer; }
.settings-switch span { display:block; width:16px; height:16px; border-radius:50%; background:white; box-shadow:0 1px 3px #0003; transition:transform .15s ease; }
.settings-switch[aria-checked="true"] { background:#0d6e9e; border-color:#0d6e9e; }
.settings-switch[aria-checked="true"] span { transform:translateX(17px); }
@media(max-width:700px) { .settings-display-options { grid-template-columns:1fr; padding:18px; gap:20px; } }
</style>
