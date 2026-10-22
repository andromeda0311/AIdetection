<script setup lang="ts">
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    type: 'button',
    variant: 'primary',
    size: 'md',
    block: false,
    loading: false,
    disabled: false,
  },
);
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--block': block, 'btn--loading': loading },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  font: var(--fs-sm) var(--font-sans);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: background 0.15s, box-shadow 0.15s, color 0.15s;
}
.btn:disabled,
.btn--loading {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn--primary {
  background: var(--c-primary);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background: var(--c-primary-hover);
}
.btn--secondary {
  background: var(--c-surface);
  color: var(--c-text);
  border: 1px solid var(--c-border);
}
.btn--secondary:hover:not(:disabled) {
  background: var(--c-border);
}
.btn--ghost {
  background: transparent;
  color: var(--c-text);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--c-border);
}
.btn--danger {
  background: var(--c-danger);
  color: #fff;
}
.btn--danger:hover:not(:disabled) {
  background: #b71c1c;
}
.btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--fs-xs);
}
.btn--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--fs-sm);
}
.btn--lg {
  padding: var(--space-3) var(--space-5);
  font-size: var(--fs-lg);
}
.btn--block {
  width: 100%;
}
.btn--loading {
  position: relative;
  color: transparent;
}
.spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>