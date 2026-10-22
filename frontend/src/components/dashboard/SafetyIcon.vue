<script setup lang="ts">
import { IconWalk, IconVideo, IconUsers, IconClock, IconTrafficLights, IconUrgent, IconSettings, IconFileText, IconDeviceFloppy, IconCalendar, IconBrain, IconSchema, IconArrowRight, IconArrowLeft, IconRestore, IconCheck, IconInfoCircle, IconMaximize, IconMinimize, IconMenu2, IconX, IconSun, IconMoon, IconLogout } from '@tabler/icons-vue';
const icons = { walk: IconWalk, video: IconVideo, users: IconUsers, clock: IconClock, traffic: IconTrafficLights, beacon: IconUrgent, settings: IconSettings, document: IconFileText, save: IconDeviceFloppy, calendar: IconCalendar, brain: IconBrain, nodes: IconSchema, arrow: IconArrowRight, back: IconArrowLeft, reset: IconRestore, check: IconCheck, info: IconInfoCircle, maximize: IconMaximize, minimize: IconMinimize, menu: IconMenu2, close: IconX, sun: IconSun, moon: IconMoon, logout: IconLogout };
defineProps<{ name: keyof typeof icons }>();
</script>
<template><component :is="icons[name]" :size="24" :stroke-width="1.8" aria-hidden="true" class="safety-icon" /></template>
<style scoped>.safety-icon { width:1.25em; height:1.25em; display:inline-block; flex-shrink:0; vertical-align:middle; }</style>
