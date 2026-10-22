<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps<{ count: number | null; preview: boolean }>();
const now = ref(Date.now());
const samples = ref<Array<{ at: number; count: number | null }>>([]);
function sample() {
  now.value = Date.now();
  samples.value.push({ at: now.value, count: props.count });
  samples.value = samples.value.filter(point => point.at >= now.value - 60_000).slice(-61);
}
watch(() => props.preview, () => { samples.value = []; sample(); }, { immediate: true });
const ticker = window.setInterval(sample, 1000);
onBeforeUnmount(() => window.clearInterval(ticker));
const points = computed(() => props.preview
  ? [0, 1, 1, 2, 3, 2, 4, 3, 2, 1, 1, 1, 1].map((count, index) => ({ at: now.value - 60_000 + index * 5000, count }))
  : samples.value);
const maximum = computed(() => Math.max(1, ...points.value.map(point => point.count ?? 0)));
const segments = computed(() => {
  const paths: string[] = []; let drawing = false;
  for (const point of points.value) {
    if (point.count == null) { drawing = false; continue; }
    const x = 24 + Math.max(0, Math.min(60_000, point.at - (now.value - 60_000))) / 60_000 * 272;
    const y = 44 - point.count / maximum.value * 36;
    paths.push((drawing ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)); drawing = true;
  }
  return paths.join(' ');
});
const last = computed(() => {
  const point = points.value.at(-1);
  return point?.count == null ? null : { x: 24 + Math.max(0, Math.min(60_000, point.at - (now.value - 60_000))) / 60_000 * 272, y: 44 - point.count / maximum.value * 36 };
});
</script>
<template>
  <figure class="pedestrian-trend" aria-label="People visible in the camera over the last minute" title="Counts of visible pedestrians. Completed crossings are not measured.">
    <div class="trend-canvas">
      <svg viewBox="0 0 300 50" preserveAspectRatio="none" role="img" :aria-label="preview ? 'Sample pedestrian-count trend' : 'Live pedestrian-count trend'">
        <path d="M24 8H296M24 26H296M24 44H296" class="trend-grid" />
        <path :d="segments" class="trend-line" />
      </svg>
      <span class="trend-axis-max">{{ maximum }}</span><span class="trend-axis-zero">0</span>
      <span v-if="last" class="trend-point-marker" :style="{ left: (last.x / 300 * 100) + '%', top: 'calc(' + (last.y / 50 * 100) + '% - ' + (24 * last.y / 50) + 'px)' }" />
      <div class="trend-time-axis"><span>−60 seconds</span><span>Now</span></div>
    </div>
    <figcaption>{{ preview ? 'Sample trend' : 'Live count trend' }} · People in view</figcaption>
  </figure>
</template>
<style scoped>
.pedestrian-trend { margin:0; min-height:0; flex:1; display:flex; flex-direction:column; gap:12px; }
.trend-canvas { position:relative; flex:1; min-height:120px; }
svg { display:block; position:absolute; top:0; left:0; width:100%; height:calc(100% - 24px); overflow:visible; }
.trend-grid { fill:none; stroke:var(--c-border); stroke-width:1; vector-effect:non-scaling-stroke; }
.trend-line { fill:none; stroke:var(--c-success); stroke-width:2.5; vector-effect:non-scaling-stroke; }
.trend-point-marker { position:absolute; width:8px; height:8px; border-radius:50%; background:var(--c-success); transform:translate(-50%,-50%); }
.trend-axis-max,.trend-axis-zero { position:absolute; left:0; color:var(--c-text-muted); font-size:12px; }
.trend-axis-max { top:9%; }.trend-axis-zero { bottom:calc(12% + 24px); }
.trend-time-axis { position:absolute; bottom:0; left:8%; right:1%; display:flex; justify-content:space-between; color:var(--c-text-muted); font-size:12px; }
figcaption { font-size:12px; color:var(--c-text-muted); }
</style>
