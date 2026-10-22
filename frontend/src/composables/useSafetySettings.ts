import { computed, ref } from 'vue';
const defaults = { detection: 5, warning: 5, vehicle: 30, crossing: 20 };
export const safetySettingFields: Array<{ key: keyof typeof defaults; label: string; help: string }> = [
  { key: 'detection', label: 'Detection Duration (seconds)', help: 'Time to confirm pedestrian detection' },
  { key: 'warning', label: 'Warning Light Duration (seconds)', help: 'Duration of warning light before signal changes' },
  { key: 'vehicle', label: 'Vehicle Red Light Duration (seconds)', help: 'Time for vehicles to stop' },
  { key: 'crossing', label: 'Pedestrian Crossing Duration (seconds)', help: 'Time for pedestrians to cross' },
];
export function useSafetySettings() {
  let initial = { ...defaults };
  try {
    const stored = JSON.parse(localStorage.getItem('safety-monitoring-settings') ?? 'null');
    if (stored && safetySettingFields.every(f => Number.isInteger(stored[f.key]) && stored[f.key] >= 1 && stored[f.key] <= 300)) initial = Object.fromEntries(safetySettingFields.map(f => [f.key, stored[f.key]])) as typeof defaults;
  } catch { /* Keep defaults if browser storage is unavailable. */ }
  const settings = ref({ ...initial });
  const saved = ref({ ...initial });
  const saveMessage = ref('');
  const saveFailed = ref(false);
  const dirty = computed(() => safetySettingFields.some(f => settings.value[f.key] !== saved.value[f.key]));
  function saveSettings() {
    if (safetySettingFields.some(f => !Number.isInteger(Number(settings.value[f.key])) || Number(settings.value[f.key]) < 1 || Number(settings.value[f.key]) > 300)) {
      saveFailed.value = true; saveMessage.value = 'Enter whole numbers from 1 to 300 seconds.'; return;
    }
    try {
      const normalized = Object.fromEntries(safetySettingFields.map(f => [f.key, Number(settings.value[f.key])])) as typeof defaults;
      localStorage.setItem('safety-monitoring-settings', JSON.stringify(normalized));
      settings.value = { ...normalized }; saved.value = { ...normalized };
      saveFailed.value = false; saveMessage.value = 'Settings saved on this device.';
    } catch { saveFailed.value = true; saveMessage.value = 'Settings could not be saved on this device.'; }
  }
  function resetDefaults() { settings.value = { ...defaults }; saveFailed.value = false; saveMessage.value = 'Default values restored. Save Settings to keep these changes.'; }
  function discard() { settings.value = { ...saved.value }; saveMessage.value = ''; saveFailed.value = false; }
  return { settings, fields: safetySettingFields, saveMessage, saveFailed, dirty, saveSettings, resetDefaults, discard };
}
