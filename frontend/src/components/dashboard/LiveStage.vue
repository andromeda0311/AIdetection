<script setup lang="ts">
import MultiCameraGrid from '@/components/dashboard/MultiCameraGrid.vue';
import type { LiveSystemState } from '@/types';

defineProps<{
  liveState: LiveSystemState | null;
}>();
</script>

<template>
  <div class="live-stage">
    <MultiCameraGrid :live-state="liveState" />
  </div>
</template>

<style scoped>
.live-stage { display:flex; flex-direction:column; min-height:0; max-width: 1280px; width: 100%; margin: 0 auto; }
</style>
