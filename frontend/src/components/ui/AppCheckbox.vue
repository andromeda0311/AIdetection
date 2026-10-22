<script setup lang="ts">
const model = defineModel<boolean>({ default: false });

defineProps<{
  id?: string;
  label?: string;
  disabled?: boolean;
}>();
</script>

<template>
  <label class="login-form__remember" :for="id">
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      class="checkbox focus-ring"
      :disabled="disabled"
    />
    <span>{{ label ?? 'Remember me' }}</span>
  </label>
</template>

<style scoped>
.checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-accent);
  cursor: pointer;
}
</style>
