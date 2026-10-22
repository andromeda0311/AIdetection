<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  columns: { field: string; header: string; width?: string }[];
  rows: Record<string, any>[];
  size?: 'sm' | 'md';
  striped?: boolean;
}>();

const sizeClass = computed(() => `table--${props.size ?? 'md'}`);
</script>

<template>
  <div class="table-wrapper">
    <table :class="['table', sizeClass, { 'table--striped': striped }]">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.field" :style="{ width: col.width }">{{ col.header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in rows" :key="ri">
          <td v-for="col in columns" :key="col.field">{{ row[col.field] }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrapper { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.table th, .table td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--c-border); }
.table th { background: var(--c-bg); color: var(--c-text-muted); font-weight: 600; }
.table--striped tbody tr:nth-child(even) { background: var(--c-bg); }
.table--sm th, .table--sm td { padding: var(--space-1) var(--space-2); font-size: var(--fs-xs); }
</style>