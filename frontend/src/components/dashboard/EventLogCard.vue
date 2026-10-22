<script setup lang="ts">
import { computed } from 'vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppBadge from '@/components/ui/AppBadge.vue';
import type { SignalEvent } from '@/types';

defineProps<{
  events: SignalEvent[];
}>();

const columns = computed(() => [
  { field: 'state', header: 'State', width: '120px' },
  { field: 'triggered_by', header: 'Triggered by', width: '130px' },
  { field: 'created_at', header: 'Time' },
]);

function signalTagSeverity(state: SignalEvent['state']) {
  if (state === 'GREEN') return 'success';
  if (state === 'YELLOW') return 'warning';
  return 'danger';
}
</script>

<template>
  <AppCard title="Signal Event Log" subtitle="Automatic and manual traffic light transitions" padding="sm">
    <AppTable v-if="events.length" :columns="columns" :rows="events" size="sm">
      <template #cell-state="{ row }">
        <AppBadge :severity="signalTagSeverity(row.state)">{{ row.state }}</AppBadge>
      </template>
      <template #cell-created_at="{ row }">
        {{ new Date(row.created_at).toLocaleString() }}
      </template>
    </AppTable>
    <p v-else class="muted">No signal events yet.</p>
  </AppCard>
</template>

<style scoped>
.muted { color:var(--c-text-muted); font-size:var(--fs-sm); }
</style>