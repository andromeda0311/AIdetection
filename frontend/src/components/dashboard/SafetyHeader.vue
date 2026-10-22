<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/composables/useTheme';
import SafetyIcon from './SafetyIcon.vue';
withDefaults(defineProps<{ online: boolean; preview: boolean; showNavigation?: boolean }>(), { showNavigation: true });
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { dark, toggle } = useTheme();
const navigationOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);
const now = ref(new Date());
const clock = window.setInterval(() => { now.value = new Date(); }, 1000);
function closeMenu() { navigationOpen.value = false; menuButton.value?.focus(); }
function escapeMenu(event: KeyboardEvent) { if (event.key === 'Escape' && navigationOpen.value) closeMenu(); }
window.addEventListener('keydown', escapeMenu);
onBeforeUnmount(() => { window.clearInterval(clock); window.removeEventListener('keydown', escapeMenu); });
watch(() => route.fullPath, () => { navigationOpen.value = false; });
const date = computed(() => now.value.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
const time = computed(() => now.value.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
const links = computed(() => [
  { to: '/dashboard', label: 'Live Monitoring', icon: 'video' as const },
  { to: '/diagnostics', label: 'Diagnostics', icon: 'nodes' as const },
  { to: '/manual', label: 'Manual Controls', icon: 'traffic' as const },
  ...(auth.isAdmin ? [
    { to: '/settings', label: 'System Settings', icon: 'settings' as const },
    { to: '/testing', label: 'System Testing', icon: 'check' as const },
    { to: '/audit-logs', label: 'Audit Logs', icon: 'document' as const },
  ] : []),
]);
async function signOut() { await auth.logout(); navigationOpen.value = false; await router.push('/login'); }
</script>
<template>
  <header class="safety-header">
    <div class="safety-header__brand"><button v-if="showNavigation" ref="menuButton" class="safety-header__menu" type="button" aria-label="Open navigation" :aria-expanded="navigationOpen" aria-controls="app-navigation" @click="navigationOpen = !navigationOpen"><SafetyIcon :name="navigationOpen ? 'close' : 'menu'" /></button><RouterLink to="/dashboard" class="safety-header__logo" aria-label="Live monitoring"><SafetyIcon name="walk" /></RouterLink><div><h1>Pedestrian Safety Monitoring</h1><p>AI-Driven Pedestrian Tracking System for Enhanced Crosswalk Safety</p></div></div>
    <div class="safety-header__right"><div class="system-status"><span :class="{ offline: !online }" />{{ online ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE' }}<small v-if="preview">PREVIEW DATA</small></div><span class="safety-header__divider" /><div class="safety-header__date"><SafetyIcon name="calendar" /><div><span>{{ date }}</span><time>{{ time }}</time></div></div><button type="button" class="safety-header__settings" :aria-pressed="dark" aria-label="Toggle dark mode" @click="toggle"><SafetyIcon :name="dark ? 'sun' : 'moon'" /></button><RouterLink v-if="showNavigation && auth.isAdmin" to="/settings" class="safety-header__settings" aria-label="Open system settings"><SafetyIcon name="settings" /></RouterLink></div>
    <template v-if="showNavigation && navigationOpen"><button class="safety-navigation-backdrop" aria-label="Close navigation" @click="closeMenu" /><nav id="app-navigation" class="safety-navigation" aria-label="Main navigation"><span class="safety-navigation__label">Monitoring workspace</span><RouterLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: route.path === link.to }" :aria-current="route.path === link.to ? 'page' : undefined"><SafetyIcon :name="link.icon" />{{ link.label }}</RouterLink><button v-if="auth.user" type="button" @click="signOut"><SafetyIcon name="logout" />Sign out</button></nav></template>
  </header>
</template>
