<script setup lang="ts">
import SafetyIcon from './SafetyIcon.vue';
defineProps<{ pedestrian?: boolean; state: 'red' | 'yellow' | 'green' | 'offline' }>();
</script>
<template>
  <div class="safety-signal">
    <span class="safety-signal__label">{{ pedestrian ? 'Pedestrian Signal' : 'Vehicle Signal' }}</span>
    <div class="signal-housing" :aria-label="(pedestrian ? 'Pedestrian' : 'Vehicle') + ' signal: ' + state"><div v-for="color in (['red', 'yellow', 'green'] as const)" :key="color" class="signal-bulb" :class="[color, { lit: state === color }]"><SafetyIcon v-if="pedestrian && color === 'green'" name="walk" /></div></div>
    <div class="signal-status-pill" :class="state"><strong>{{ state === 'offline' ? 'OFFLINE' : state.toUpperCase() }}</strong><span>{{ state === 'offline' ? 'No signal available' : pedestrian ? state === 'green' ? 'Pedestrians May Cross' : 'Pedestrians Wait' : state === 'red' ? 'Vehicles Stop' : state === 'yellow' ? 'Vehicles Slow' : 'Vehicles Go' }}</span></div>
  </div>
</template>
