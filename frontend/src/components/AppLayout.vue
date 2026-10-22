<script setup lang="ts">
import { provide } from 'vue';
import { useRoute } from 'vue-router';
import { useLiveSystemState } from '@/composables/useLiveSystemState';
import { useWebcamDetection } from '@/composables/useWebcamDetection';
import { useDetectionReporter } from '@/composables/useDetectionReporter';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/composables/useTheme';
import SafetyHeader from '@/components/dashboard/SafetyHeader.vue';
import { authDisabled } from '@/utils/preview';
const route = useRoute();
const { dark } = useTheme();
const { liveState, available: connected } = useLiveSystemState();
provide('operationsState', { liveState, connected });
// Webcam monitoring lives here, not in a page, so it keeps running (and keeps feeding
// the traffic-light cycle) while the operator uses other pages. Logging out unmounts it.
const auth = useAuthStore();
const detection = useWebcamDetection();
const reporter = useDetectionReporter(detection, { enabled: () => !authDisabled && Boolean(auth.accessToken) });
provide('webcamDetection', detection);
provide('detectionReporter', reporter);
</script>
<template>
  <div class="safety-shell" :class="{ 'safety-shell--dark': dark }">
    <SafetyHeader :online="connected || (authDisabled && !liveState)" :preview="authDisabled && !liveState" />
    <main class="safety-main" :class="{ 'safety-main--page': route.path !== '/dashboard' }">
      <router-view />
    </main>
  </div>
</template>
