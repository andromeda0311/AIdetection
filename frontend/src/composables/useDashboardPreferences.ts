import { ref } from 'vue';

const adjustmentsVisible = ref(true);
try { adjustmentsVisible.value = localStorage.getItem('dashboard-adjustments-visible') !== 'false'; } catch { /* Use visible defaults when storage is unavailable. */ }

export function useDashboardPreferences() {
  function setAdjustmentsVisible(visible: boolean) {
    adjustmentsVisible.value = visible;
    try { localStorage.setItem('dashboard-adjustments-visible', String(visible)); } catch { /* The current session can still use this preference. */ }
  }
  return { adjustmentsVisible, setAdjustmentsVisible };
}
