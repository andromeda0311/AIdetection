<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  state?: string | null;
}

const props = defineProps<Props>();

const normalizedState = computed(() => {
  if (!props.state) return 'GREEN';
  const s = props.state.toUpperCase();
  if (s === 'STOPPED' || s === 'RED') return 'RED';
  if (s === 'CAUTION' || s === 'YELLOW') return 'YELLOW';
  return 'GREEN';
});

function lightStyle(position: 'top' | 'mid' | 'bottom') {
  const current = normalizedState.value;
  const isActive =
    (position === 'top' && current === 'RED') ||
    (position === 'mid' && current === 'YELLOW') ||
    (position === 'bottom' && current === 'GREEN');

  if (!isActive) return { opacity: 0.25, filter: 'grayscale(60%)' };

  if (position === 'top') return { opacity: 1, boxShadow: '0 0 20px #ef4444, 0 0 40px #ef4444' };
  if (position === 'mid') return { opacity: 1, boxShadow: '0 0 20px #f59e0b, 0 0 40px #f59e0b' };
  return { opacity: 1, boxShadow: '0 0 20px #22c55e, 0 0 40px #22c55e' };
}
</script>

<template>
  <div class="traffic-light-wrapper" aria-label="Traffic light state">
    <div class="traffic-light" :class="normalizedState">
      <div class="light top" :style="lightStyle('top')" />
      <div class="light mid" :style="lightStyle('mid')" />
      <div class="light bottom" :style="lightStyle('bottom')" />
    </div>
    <div class="state-label" :class="`label-${normalizedState.toLowerCase()}`">
      {{ normalizedState }}
    </div>
  </div>
</template>

<style scoped>
.traffic-light-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  min-width: 80px;
}

.traffic-light {
  width: 54px;
  height: 160px;
  background: #1e293b;
  border: 2px solid #334155;
  border-radius: 12px;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.light {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.top { background: #ef4444; }
.mid { background: #f59e0b; }
.bottom { background: #22c55e; }

.state-label {
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.label-red { color: #ef4444; }
.label-yellow { color: #f59e0b; }
.label-green { color: #22c55e; }
</style>