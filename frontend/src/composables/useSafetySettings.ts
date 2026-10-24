import { computed, ref } from 'vue';
import { getSignalConfig, updateSignalConfig } from '../api';
import { getErrorMessage } from '../api/client';

/** The three automatic-cycle timings, shown and edited as whole seconds. */
export interface CycleTimings { detection: number; warning: number; red: number }

function secondsToMs(values: CycleTimings) {
  return { detectionThresholdMs: Number(values.detection) * 1000, yellowMs: Number(values.warning) * 1000, redMs: Number(values.red) * 1000 };
}
function msToSeconds(config: { detectionThresholdMs: number; yellowMs: number; redMs: number }): CycleTimings {
  return { detection: config.detectionThresholdMs / 1000, warning: config.yellowMs / 1000, red: config.redMs / 1000 };
}

const defaults: CycleTimings = { detection: 5, warning: 5, red: 15 };
export const cycleTimingFields: Array<{ key: keyof CycleTimings; label: string; help: string; min: number; max: number }> = [
  { key: 'detection', label: 'Detection time (seconds)', help: 'How long a person must be seen before the caution phase starts', min: 1, max: 60 },
  { key: 'warning', label: 'Warning light (seconds)', help: 'Duration of warning light before vehicles are stopped', min: 1, max: 60 },
  { key: 'red', label: 'Red light / pedestrian crossing (seconds)', help: 'Vehicles are stopped while pedestrians cross', min: 5, max: 300 },
];

/**
 * The automatic-cycle timings of the traffic-signal engine. They live on the
 * server (signal_config), editable by administrators, so saving changes the
 * cycle on every device; the API works in milliseconds, the forms in seconds.
 */
export function useSafetySettings() {
  const settings = ref<CycleTimings>({ ...defaults });
  const saved = ref<CycleTimings>({ ...defaults });
  const fields = cycleTimingFields;
  const loading = ref(false);
  const loadFailed = ref(false);
  const saving = ref(false);
  const message = ref('');
  const messageFailed = ref(false);
  const dirty = computed(() => fields.some(f => settings.value[f.key] !== saved.value[f.key]));

  async function loadTimings() {
    loading.value = true;
    try {
      const config = await getSignalConfig();
      settings.value = msToSeconds(config);
      saved.value = { ...settings.value };
      message.value = ''; messageFailed.value = false;
    } catch {
      loadFailed.value = true; message.value = 'Timings are unavailable.'; messageFailed.value = true;
    } finally { loading.value = false; }
  }

  function settingsValid(): boolean {
    return fields.every(f => Number.isInteger(Number(settings.value[f.key])) && Number(settings.value[f.key]) >= f.min && Number(settings.value[f.key]) <= f.max);
  }

  async function saveSettings() {
    if (!settingsValid()) { messageFailed.value = true; message.value = 'Enter whole numbers within the displayed limits.'; return; }
    saving.value = true;
    try {
      const config = await updateSignalConfig(secondsToMs(settings.value));
      settings.value = msToSeconds(config);
      saved.value = { ...settings.value };
      loadFailed.value = false; messageFailed.value = false;
      message.value = 'Saved. New timings apply from the next cycle on every device.';
    } catch (error) { messageFailed.value = true; message.value = getErrorMessage(error); }
    finally { saving.value = false; }
  }
  function resetDefaults() { settings.value = { ...defaults }; messageFailed.value = false; message.value = 'Default values restored. Save Settings to keep these changes.'; }
  function discard() { settings.value = { ...saved.value }; message.value = ''; messageFailed.value = false; }
  return { settings, fields, loading, loadFailed, saving, message, messageFailed, dirty, loadTimings, saveSettings, resetDefaults, discard };
}
