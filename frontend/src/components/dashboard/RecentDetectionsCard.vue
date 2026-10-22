<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppCard from '@/components/ui/AppCard.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppButton from '@/components/ui/AppButton.vue';
import type { Detection } from '@/types';

defineProps<{
  items: Detection[];
}>();
defineEmits<{
  open: [id: string];
}>();

const router = useRouter();

const columns = computed(() => [
  { field: 'inputFileName', header: 'File' },
  { field: 'totalPedestrians', header: 'Count', width: '80px' },
  { field: 'status', header: 'Status', width: '110px' },
  { field: '', header: '', width: '70px' },
]);

function tagSeverity(status: Detection['status']) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'info';
}
</script>

<template>
  <AppCard title="Recent Detections" subtitle="Latest uploaded video analyses" padding="sm">
    <AppTable v-if="items.length" :columns="columns" :rows="items" size="sm">
      <template #cell-status="{ row }">
        <span class="badge" :class="`badge--${tagSeverity(row.status)}`">{{ row.status }}</span>
      </template>
      <template #cell-last="{ row }">
        <AppButton icon="pi pi-arrow-right" text rounded size="sm" aria-label="View detection" @click="$emit('open', row.id)" />
      </template>
    </AppTable>
    <p v-else class="muted">No detections yet.</p>
  </AppCard>
</template>

<style scoped>
.badge { display:inline-flex; align-items:center; padding:var(--space-1) var(--space-2); border-radius:var(--radius-full); font-size:var(--fs-xs); font-weight:600; }
.badge--success { background:rgba(30,142,62,0.15); color:var(--c-success); }
.badge--danger { background:rgba(217,48,37,0.15); color:var(--c-danger); }
.badge--info { background:rgba(26,115,232,0.15); color:var(--c-primary); }
.muted { color:var(--c-text-muted); font-size:var(--fs-sm); }
</style>