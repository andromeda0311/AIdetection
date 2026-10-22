<script setup lang="ts">
defineProps<{
  variant?: 'error' | 'success';
}>();
</script>

<template>
  <div
    class="message"
    :class="`message--${variant ?? 'error'}`"
    role="alert"
    aria-live="polite"
  >
    <slot />
  </div>
</template>
