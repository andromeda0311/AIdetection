<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue';

defineProps<{
  isManualMode: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  change: [mode: 'auto' | 'manual'];
}>();
</script>

<template>
  <div class="mode-toggle" role="group" aria-label="Operating mode">
    <AppButton
      variant="primary"
      size="sm"
      :class="{ 'mode-btn--active': !isManualMode }"
      :disabled="loading"
      @click="emit('change', 'auto')"
    >
      Auto Detection
    </AppButton>
    <AppButton
      variant="primary"
      size="sm"
      :class="{ 'mode-btn--active mode-btn--manual': isManualMode }"
      :disabled="loading"
      @click="emit('change', 'manual')"
    >
      Manual Override
    </AppButton>
  </div>
</template>

<style scoped>
.mode-toggle {
  display: flex;
  gap: var(--space-2);
}

.mode-btn--active {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.mode-btn--active.mode-btn--manual {
  background: #d97706;
  border-color: #d97706;
}
</style>
