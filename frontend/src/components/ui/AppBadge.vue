<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  severity?: 'success' | 'info' | 'warning' | 'danger' | 'secondary';
  label?: string;
}>();

const cls = computed(() => ['badge', `badge--${props.severity ?? 'secondary'}`]);
</script>

<template>
  <span :class="cls">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--fs-xs);
  font-weight: 600;
  line-height: 1;
}
.badge--success { background: rgba(30,142,62,0.15); color: var(--c-success); }
.badge--info { background: rgba(26,115,232,0.15); color: var(--c-primary); }
.badge--warning { background: rgba(249,171,0,0.15); color: var(--c-warning); }
.badge--danger { background: rgba(217,48,37,0.15); color: var(--c-danger); }
.badge--secondary { background: var(--c-border); color: var(--c-text-muted); }
</style>