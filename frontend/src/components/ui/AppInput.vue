<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const model = defineModel<string | number>({ default: '' });

defineProps<{
  id?: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  invalid?: boolean;
  disabled?: boolean;
}>();
</script>

<template>
  <div class="input-wrap" :class="{ 'input-wrap--error': invalid }">
    <input
      :id="id"
      v-model="model"
      class="input focus-ring"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="invalid ? 'true' : undefined"
      :disabled="disabled"
      v-bind="$attrs"
    />
  </div>
</template>
