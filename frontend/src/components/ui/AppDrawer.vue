<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  position?: 'left' | 'right';
  width?: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const isOpen = computed({
  get() { return props.modelValue; },
  set(v) { emit('update:modelValue', v); },
});
</script>

<template>
  <Transition name="drawer">
    <div v-if="isOpen">
      <div class="drawer-overlay" @click.self="isOpen = false" />
      <aside
        class="drawer"
        :class="`drawer--${props.position ?? 'right'}`"
        :style="{ width: props.width ?? '320px' }"
        @click.self="isOpen = false"
      >
        <div class="drawer__header">
          <slot name="header" />
          <button class="btn btn--ghost btn--sm" @click="isOpen = false" aria-label="Close">
            <i class="pi pi-times" />
          </button>
        </div>
        <div class="drawer__body">
          <slot />
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  z-index: calc(var(--z-drawer) - 1);
}
.drawer {
  position: fixed; top: 0; bottom: 0; background: var(--c-surface);
  box-shadow: var(--shadow-3); z-index: var(--z-drawer);
  display: flex; flex-direction: column;
}
.drawer--right { right: 0; }
.drawer--left { left: 0; }
.drawer__header { display:flex; justify-content:space-between; align-items:center; padding:var(--space-3) var(--space-4); border-bottom:1px solid var(--c-border); }
.drawer__body { flex:1; overflow:auto; padding:var(--space-4); }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.drawer--left.drawer-enter-from, .drawer--left.drawer-leave-to { transform: translateX(-100%); }
</style>