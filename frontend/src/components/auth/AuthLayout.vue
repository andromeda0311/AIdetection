<script setup lang="ts">
import SafetyHeader from '@/components/dashboard/SafetyHeader.vue';
import { useTheme } from '@/composables/useTheme';
const { dark } = useTheme();
</script>
<template><div class="auth-page" :class="{ 'safety-shell--dark': dark }"><SafetyHeader :online="false" :preview="false" :show-navigation="false" /><main class="auth-main"><slot /></main></div></template>
