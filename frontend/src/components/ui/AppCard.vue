<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
  bordered?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}>();

const paddingMap = {
  none: '0',
  sm: 'var(--space-3)',
  md: 'var(--space-4)',
  lg: 'var(--space-5)',
};
</script>

<template>
  <article class="card" :class="{ 'card--bordered': bordered }" :style="{ padding: paddingMap[padding ?? 'md'] }">
    <header v-if="title || subtitle" class="card__header">
      <h3 v-if="title" class="card__title">{{ title }}</h3>
      <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
    </header>
    <div class="card__body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.card {
  background: var(--c-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
  display: flex;
  flex-direction: column;
}
.card--bordered {
  border: 1px solid var(--c-border);
}
.card__header {
  margin-bottom: var(--space-3);
}
.card__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--c-text);
}
.card__subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}
.card__body {
  flex: 1;
}
</style>