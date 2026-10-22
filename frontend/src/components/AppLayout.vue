<script setup lang="ts">
import { provide } from 'vue';
import { useRoute } from 'vue-router';
import { useLiveSystemState } from '@/composables/useLiveSystemState';
import { useTheme } from '@/composables/useTheme';
import SafetyHeader from '@/components/dashboard/SafetyHeader.vue';
import { authDisabled } from '@/utils/preview';
const route = useRoute();
const { dark } = useTheme();
const { liveState, available: connected } = useLiveSystemState();
provide('operationsState', { liveState, connected });
</script>
<template>
  <div class="safety-shell" :class="{ 'safety-shell--dark': dark }">
    <SafetyHeader :online="connected || (authDisabled && !liveState)" :preview="authDisabled && !liveState" />
    <main class="safety-main" :class="{ 'safety-main--page': route.path !== '/dashboard' }">
      <router-view />
    </main>
  </div>
</template>
