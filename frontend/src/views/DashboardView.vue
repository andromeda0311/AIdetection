<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch, type Ref } from 'vue';
import SafetyIcon from '@/components/dashboard/SafetyIcon.vue';
import SafetyCamera from '@/components/dashboard/SafetyCamera.vue';
import SafetySignal from '@/components/dashboard/SafetySignal.vue';
import PedestrianTrend from '@/components/dashboard/PedestrianTrend.vue';
import { useSafetySettings } from '@/composables/useSafetySettings';
import { useDashboardPreferences } from '@/composables/useDashboardPreferences';
import type { WebcamDetection } from '@/composables/useWebcamDetection';
import { authDisabled } from '@/utils/preview';
import type { LiveSystemState } from '@/types';

const { liveState, connected } = inject<{ liveState: Ref<LiveSystemState | null>; connected: Ref<boolean> }>('operationsState')!;
const preview = computed(() => authDisabled && !liveState.value);
// People are detected in this browser from the local webcam; null means detection is not running.
const detection = inject<WebcamDetection>('webcamDetection')!;
const count = computed(() => preview.value && detection.status.value === 'idle' ? 1 : detection.count.value);
const pedestrianInView = computed(() => (detection.count.value ?? 0) > 0);
const countDialog = ref<HTMLDialogElement | null>(null);
function expandCount() { countDialog.value?.showModal(); }
const timerTarget = ref<'pedestrian' | 'vehicle'>('pedestrian');
try { if (localStorage.getItem('dashboard-timer-target') === 'vehicle') timerTarget.value = 'vehicle'; } catch { /* Use the pedestrian timer by default. */ }
function selectTimer(target: 'pedestrian' | 'vehicle') {
  timerTarget.value = target;
  try { localStorage.setItem('dashboard-timer-target', target); } catch { /* Keep the selected timer for this session. */ }
}
const seconds = computed(() => preview.value ? (timerTarget.value === 'pedestrian' ? 18 : 30) : !connected.value ? null : timerTarget.value === 'vehicle' ? liveState.value?.carTimer ?? null : liveState.value?.pedTimer ?? (liveState.value?.cyclePhase === 'STOPPED' ? liveState.value.cycleRemainingSec : null) ?? null);
const countdown = computed(() => seconds.value == null ? '--:--' : String(Math.floor(seconds.value / 60)).padStart(2, '0') + ':' + String(Math.floor(seconds.value % 60)).padStart(2, '0'));
const vehicleSignal = computed<'red' | 'yellow' | 'green' | 'offline'>(() => preview.value ? 'red' : !connected.value ? 'offline' : liveState.value?.traffic === 'stopped' ? 'red' : liveState.value?.traffic === 'caution' ? 'yellow' : 'green');
const pedestrianSignal = computed<'red' | 'green' | 'offline'>(() => preview.value ? 'green' : !connected.value ? 'offline' : liveState.value?.pedState === 'WALK' ? 'green' : 'red');
const warningActive = computed(() => preview.value || Boolean(connected.value && liveState.value?.traffic === 'caution'));

// The three automatic-cycle timings are server values; the dashboard shows
// them read-only and links to Settings where an admin can change them.
const { settings, fields, loadFailed: timingsLoadFailed, loading: timingsLoading, loadTimings } = useSafetySettings();
onMounted(loadTimings);
const timingValue = (key: 'detection' | 'warning' | 'red') => {
  if (timingsLoading.value) return '…';
  if (timingsLoadFailed.value) return '—';
  return settings.value[key];
};
const { adjustmentsVisible, setAdjustmentsVisible } = useDashboardPreferences();
const sampleActivity = ['03:24:12 PM', '03:23:45 PM', '03:22:18 PM', '03:20:56 PM', '03:19:32 PM'].map((time, index) => ({ id: 'sample-' + index, time, event: 'Pedestrian detected', triggered: true }));
const recentActivity = ref<Array<{ id: string; time: string; event: string; triggered: boolean }>>([]);
const activity = computed(() => preview.value ? sampleActivity : recentActivity.value);
watch(() => [pedestrianInView.value, liveState.value?.cycleActive] as const, ([detected, cycle], previous) => {
  if (detected && !previous?.[0]) recentActivity.value.unshift({ id: String(Date.now()), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }), event: 'Pedestrian detected', triggered: Boolean(cycle) });
  else if (cycle && !previous?.[1] && recentActivity.value[0]) recentActivity.value[0].triggered = true;
  recentActivity.value = recentActivity.value.slice(0, 5);
});
const mobilePanel = ref<'camera' | 'status' | 'adjustments' | 'activity'>('camera');
const mobilePanels = ['camera', 'status', 'adjustments', 'activity'] as const;
const hideControlsButton = ref<HTMLButtonElement | null>(null);
async function toggleControls() {
  setAdjustmentsVisible(!adjustmentsVisible.value);
  await nextTick();
  hideControlsButton.value?.focus();
}
</script>
<template>
  <div class="safety-dashboard" :class="{ 'safety-dashboard--controls-hidden': !adjustmentsVisible }" :data-panel="mobilePanel">
    <nav class="safety-mobile-tabs" aria-label="Monitoring panels"><button v-for="panel in mobilePanels" :key="panel" :aria-pressed="mobilePanel === panel" :class="{ active: mobilePanel === panel }" @click="mobilePanel = panel">{{ panel === 'camera' ? 'Webcam' : panel === 'status' ? 'Status' : panel === 'adjustments' ? 'Adjustments' : 'Activity' }}</button></nav>
    <div class="safety-top-grid">
      <SafetyCamera :detection="detection" :preview="preview" />
      <div class="safety-summary-grid">
        <div class="safety-summary-column">
          <section class="safety-card metric-detected"><header class="safety-card__header"><h2><SafetyIcon name="users" />Pedestrians Detected</h2><button type="button" class="camera-expand" aria-label="Expand pedestrian count" aria-haspopup="dialog" @click="expandCount"><SafetyIcon name="maximize" /></button></header><div class="safety-metric-body"><strong>{{ count ?? '—' }}</strong><span>Current count</span></div></section>
          <section class="safety-card metric-countdown"><header class="safety-card__header"><h2><SafetyIcon name="clock" />Countdown Timer</h2><select class="countdown-target" aria-label="Countdown signal" :value="timerTarget" @change="selectTimer(($event.target as HTMLSelectElement).value as 'pedestrian' | 'vehicle')"><option value="pedestrian">Pedestrian</option><option value="vehicle">Car</option></select></header><div class="safety-metric-body"><strong>{{ countdown }}</strong><span>{{ timerTarget === 'pedestrian' ? 'Pedestrian time remaining' : 'Car time remaining' }}</span></div></section>
        </div>
        <div class="safety-summary-column safety-summary-column--signals">
          <section class="safety-card traffic-status-card"><header class="safety-card__header"><h2><SafetyIcon name="traffic" />Traffic-Light Status</h2></header><div class="safety-signals"><SafetySignal :state="vehicleSignal" /><SafetySignal pedestrian :state="pedestrianSignal" /></div></section>
          <section class="safety-card warning-status-card"><header class="safety-card__header"><h2><SafetyIcon name="beacon" />Warning-Light Status</h2></header><div class="warning-status-body"><div class="warning-beacon" :class="{ active: warningActive }" aria-label="Warning beacon"><span class="beacon-rays"><i /><i /><i /><i /><i /></span><span class="beacon-dome"><span /></span><span class="beacon-base" /></div><div><strong class="warning-pill" :class="{ active: warningActive }">{{ warningActive ? 'ACTIVE' : 'INACTIVE' }}</strong><p>{{ warningActive ? 'Warning light is ON' : 'Warning light is OFF' }}</p></div></div></section>
        </div>
      </div>
    </div>
    <div class="safety-bottom-grid">
      <section class="safety-card adjustments-card" :class="{ 'adjustments-card--collapsed': !adjustmentsVisible }"><header class="safety-card__header"><h2><SafetyIcon name="settings" />System Adjustments</h2><button ref="hideControlsButton" type="button" class="adjustments-toggle" :aria-expanded="adjustmentsVisible" aria-controls="dashboard-adjustments-form" @click="toggleControls">{{ adjustmentsVisible ? 'Hide settings' : 'Show settings' }}</button></header><div v-show="adjustmentsVisible" id="dashboard-adjustments-form" class="safety-adjustments"><div class="adjustment-fields"><div v-for="field in fields" :key="field.key"><label :for="'safety-' + field.key">{{ field.label }}</label><output :id="'safety-' + field.key" class="adjustment-value" :aria-describedby="'help-' + field.key">{{ timingValue(field.key) }} s</output><small :id="'help-' + field.key">{{ field.help }}</small></div></div><div class="settings-save-row"><RouterLink class="save-safety-settings adjustments-link" to="/settings"><SafetyIcon name="settings" />Change in Settings</RouterLink><span v-if="timingsLoadFailed" class="save-feedback error" role="status">Timings are unavailable.</span></div></div></section>
      <section class="safety-card activity-card"><header class="safety-card__header"><h2><SafetyIcon name="document" />Recent Detection Activity</h2></header><div class="safety-activity-table"><table><thead><tr><th>Time</th><th>Event</th><th>Status</th></tr></thead><tbody><tr v-for="row in activity" :key="row.id"><td>{{ row.time }}</td><td>{{ row.event }}</td><td><span class="activity-status"><i :class="{ pending: !row.triggered }" />{{ row.triggered ? 'Triggered traffic light sequence' : 'Detection confirmation pending' }}</span></td></tr><tr v-if="!activity.length"><td colspan="3" class="activity-empty">Detection events will appear during this monitoring session.</td></tr></tbody></table></div></section>
    </div>
    <section class="safety-card system-process"><h2><SafetyIcon name="nodes" />System Process</h2><div class="process-step"><span class="process-icon"><SafetyIcon name="video" /></span><div><strong>Webcam</strong><p>Captures live video feed</p></div></div><SafetyIcon name="arrow" class="process-arrow" /><div class="process-step"><span class="process-icon"><SafetyIcon name="brain" /></span><div><strong>Pedestrian Detection</strong><p>AI in the browser detects pedestrians</p></div></div><SafetyIcon name="arrow" class="process-arrow" /><div class="process-step"><span class="process-icon"><SafetyIcon name="traffic" /></span><div><strong>Traffic-Light Sequence</strong><p>Triggers traffic light response</p></div></div></section>
    <dialog ref="countDialog" class="pedestrian-count-dialog" aria-labelledby="pedestrian-trend-title" @click="($event.target === countDialog) && countDialog?.close()"><section class="count-expanded-card"><header class="count-expanded-header"><div><h2 id="pedestrian-trend-title">Pedestrian Count</h2><p>People detected over the last 60 seconds</p></div><button type="button" class="camera-expand" aria-label="Close pedestrian count" @click="countDialog?.close()"><SafetyIcon name="close" /></button></header><div class="count-expanded-body"><div class="count-expanded-current"><strong>{{ count ?? '—' }}</strong><span>People currently in view</span></div><PedestrianTrend :count="count" :preview="preview" /><p class="count-expanded-note">This chart shows visible detections. Unique completed crossings are not measured.</p></div></section></dialog>
  </div>
</template>
