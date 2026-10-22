<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });

defineProps<{
  id?: string;
  placeholder?: string;
  autocomplete?: string;
  invalid?: boolean;
  disabled?: boolean;
}>();

const visible = ref(false);

function toggleVisibility() {
  visible.value = !visible.value;
}
</script>

<template>
  <div class="input-wrap password-wrap" :class="{ 'input-wrap--error': invalid }">
    <input
      :id="id"
      v-model="model"
      class="input focus-ring password-input"
      :type="visible ? 'text' : 'password'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="invalid ? 'true' : undefined"
      :disabled="disabled"
      v-bind="$attrs"
    />
    <button
      type="button"
      class="password-toggle btn btn--ghost btn--icon"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      tabindex="-1"
      @click="toggleVisibility"
    >
      <i :class="visible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.password-wrap {
  position: relative;
}

.password-input {
  padding-right: 2.75rem;
}

.password-toggle {
  position: absolute;
  right: 0.375rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  min-width: 2rem;
  min-height: 2rem;
}
</style>
