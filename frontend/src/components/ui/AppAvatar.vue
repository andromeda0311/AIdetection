<script setup lang="ts">
defineProps<{
  src?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}>();

const sizeMap = {
  sm: '2rem',
  md: '2.5rem',
  lg: '3rem',
  xl: '4rem',
};
</script>

<template>
  <div
    class="avatar"
    :style="{ width: sizeMap[size ?? 'md'], height: sizeMap[size ?? 'md'], fontSize: sizeMap[size ?? 'md'] }"
  >
    <img v-if="src" :src="src" :alt="alt" class="avatar__img" />
    <span v-else class="avatar__initials">{{ initials }}</span>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: var(--radius-full);
  background: var(--c-primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  overflow: hidden;
}
.avatar__img { width: 100%; height: 100%; object-fit: cover; }
.avatar__initials { text-transform: uppercase; }
</style>