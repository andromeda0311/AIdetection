<script setup lang="ts">
import { ref } from 'vue';
const expanded = ref(false);
</script>
<template>
  <section class="ops-panel crosswalk-map" :class="{ 'crosswalk-map--expanded': expanded }" @keydown.esc="expanded = false">
    <header class="ops-panel__header"><div><h2><i class="pi pi-map" aria-hidden="true" />Intersection overview</h2><p>Crosswalk layout / schematic view</p></div><button class="ops-icon-button" :aria-expanded="expanded" aria-label="Expand intersection map" @click="expanded = !expanded"><i :class="expanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" /></button></header>
    <div class="crosswalk-map__drawing" :class="{ expanded }" role="img" aria-label="Illustrative intersection schematic with a pedestrian crossing">
      <span class="map-road map-road--vertical" /><span class="map-road map-road--horizontal" />
      <span class="map-crossing north" /><span class="map-crossing south" /><span class="map-crossing east" /><span class="map-crossing west" />
      <span class="map-node"><i class="pi pi-map-marker" aria-hidden="true" /></span><span class="map-label">Crosswalk monitoring point</span>
      <span class="map-compass mono">N ↑</span><span class="map-caption mono">Illustrative layout</span>
    </div>
    <footer class="ops-panel__footer mono">Site coordinates have not been configured</footer>
  </section>
</template>
