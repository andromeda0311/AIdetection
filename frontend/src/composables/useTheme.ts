import { ref, watch } from 'vue';

// Shared by the header and profile settings so both stay in sync.
const saved = localStorage.getItem('darkMode');
const dark = ref(saved === null ? true : saved === 'true');
function apply() { document.documentElement.classList.toggle('dark', dark.value); }
apply();
watch(dark, () => { localStorage.setItem('darkMode', String(dark.value)); apply(); });
export function useTheme() {
  return { dark, toggle: () => { dark.value = !dark.value; } };
}
