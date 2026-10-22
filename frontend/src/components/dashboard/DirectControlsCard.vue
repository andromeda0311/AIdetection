<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue';
import AppButton from '@/components/ui/AppButton.vue';

defineProps<{
  greenSec: number;
  yellowSec: number;
  redSec: number;
  busy: boolean;
}>();

const emit = defineEmits<{
  runCycle: [];
  press: [phase: 'GREEN' | 'YELLOW' | 'RED'];
}>();
</script>

<template>
  <AppCard
    title="Direct Signal Controls"
    subtitle="Click to immediately switch physical traffic light phase"
    bordered
  >
    <div class="full-cycle-action">
      <AppButton variant="primary" size="lg" block :disabled="busy" @click="emit('runCycle')">
        Run Full Cycle ({{ greenSec }}s Green → {{ yellowSec }}s Yellow → {{ redSec }}s Red)
      </AppButton>
    </div>

    <div class="manual-buttons">
      <AppButton variant="primary" size="lg" :disabled="busy" @click="emit('press', 'GREEN')">
        Green (Normal)
      </AppButton>
      <AppButton variant="secondary" size="lg" :disabled="busy" @click="emit('press', 'YELLOW')">
        Yellow (Caution)
      </AppButton>
      <AppButton variant="danger" size="lg" :disabled="busy" @click="emit('press', 'RED')">
        Red (Stop)
      </AppButton>
    </div>
  </AppCard>
</template>

<style scoped>
.full-cycle-action {
  margin-bottom: var(--space-4);
}

.manual-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

@media (max-width: 640px) {
  .manual-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
