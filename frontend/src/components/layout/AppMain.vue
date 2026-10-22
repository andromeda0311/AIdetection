<script setup lang="ts">
defineProps<{
  maxWidth?: string;
}>();
</script>

<template>
  <main class="app-main" :style="{ maxWidth: maxWidth ?? 'none' }">
    <slot />
  </main>
</template>

<style scoped>
.app-main {
  flex: 1;
  padding: var(--space-5);
  background: var(--c-bg);
  overflow-y: auto;
}
</style>