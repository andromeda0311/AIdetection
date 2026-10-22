<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { listAuditLogs, exportAuditLogsCsv, type AuditLogFilters } from '@/api';
import type { AuditLog } from '@/types';
import AppButton from '@/components/ui/AppButton.vue';
import { useToast } from 'primevue/usetoast';
import { getErrorMessage } from '@/api/client';

const toast = useToast();

const events = ref<AuditLog[]>([]);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const loadError = ref('');
const selected = ref<AuditLog | null>(null);
const copied = ref(false);
async function copyPayload() {
  if (!selected.value) return;
  try { await navigator.clipboard.writeText(JSON.stringify(selected.value, null, 2)); copied.value = true; }
  catch { toast.add({ severity: 'error', summary: 'Clipboard unavailable', life: 3000 }); }
}

// Filters
const filterState = ref<'' | 'GREEN' | 'YELLOW' | 'RED'>('');
const filterTrigger = ref<'' | 'auto' | 'admin'>('');
const filterStart = ref('');
const filterEnd = ref('');

// Pagination
const page = ref(1);
const pageSize = ref(10);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const visiblePages = computed(() => {
  const count = totalPages.value;
  const current = page.value;
  const windowSize = 5;
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  const end = Math.min(count, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});
const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1));
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value));

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const params: AuditLogFilters = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
    };
    if (filterState.value) params.state = filterState.value;
    if (filterTrigger.value) params.triggeredBy = filterTrigger.value;
    if (filterStart.value) params.startDate = new Date(filterStart.value).toISOString();
    if (filterEnd.value) params.endDate = new Date(filterEnd.value).toISOString();

    const data = await listAuditLogs(params);
    events.value = data.items;
    selected.value = null;
    copied.value = false;
    total.value = data.total;
    if (page.value > totalPages.value) page.value = totalPages.value;
  } catch (err) {
    loadError.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  load();
}

function resetFilters() {
  filterState.value = '';
  filterTrigger.value = '';
  filterStart.value = '';
  filterEnd.value = '';
  page.value = 1;
  load();
}

watch([filterState, filterTrigger], () => applyFilters());

function goToPage(target: number) {
  if (target < 1 || target > totalPages.value || target === page.value) return;
  page.value = target;
  load();
}

async function handleExport() {
  exporting.value = true;
  try {
    await exportAuditLogsCsv();
    toast.add({ severity: 'success', summary: 'Exported', detail: 'Audit logs exported to CSV', life: 3000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Export Failed', detail: getErrorMessage(err), life: 3000 });
  } finally {
    exporting.value = false;
  }
}

const stateOptions = [
  { label: 'All States', value: '' },
  { label: 'Green', value: 'GREEN' },
  { label: 'Yellow', value: 'YELLOW' },
  { label: 'Red', value: 'RED' },
];
const triggerOptions = [
  { label: 'All Triggers', value: '' },
  { label: 'Automatic', value: 'auto' },
  { label: 'Admin', value: 'admin' },
];

function actorName(log: AuditLog): string {
  if (log.user) {
    const name = `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim();
    return name || log.user.email;
  }
  return log.triggeredBy === 'auto' ? 'System (Auto)' : 'Admin';
}

function actorInitials(log: AuditLog): string {
  const name = actorName(log);
  return name.charAt(0).toUpperCase();
}

function formatDayName(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
}

function formatTime(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateBadge(value?: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function stateClass(state: AuditLog['state']): string {
  return `state--${state.toLowerCase()}`;
}

onMounted(load);
</script>

<template>
  <div class="ops-page">
    <header class="ops-page-heading"><div><p class="ops-eyebrow">System events / Telemetry registry</p><h2>Incident &amp; audit event logs</h2><p>Recorded signal transitions, automated triggers, and operator interventions.</p></div><AppButton :loading="exporting" :disabled="!!loadError || loading" @click="handleExport"><i class="pi pi-download" />Export audit trail (CSV)</AppButton></header>
    <div class="ops-metrics">
      <article class="ops-metric"><span class="ops-metric__label">Matching records<i class="pi pi-list" /></span><strong>{{ loadError ? '—' : total }}</strong><p>Current filter results</p></article>
      <article class="ops-metric"><span class="ops-metric__label">Automatic triggers<i class="pi pi-bolt" /></span><strong>{{ loadError ? '—' : events.filter(e => e.triggeredBy === 'auto').length }}</strong><p>On this page</p></article>
      <article class="ops-metric"><span class="ops-metric__label">Operator commands<i class="pi pi-user" /></span><strong>{{ loadError ? '—' : events.filter(e => e.triggeredBy === 'admin').length }}</strong><p>On this page</p></article>
      <article class="ops-metric"><span class="ops-metric__label">Registry status<i class="pi pi-database" /></span><strong>{{ loading ? 'Loading' : loadError ? 'Offline' : 'Available' }}</strong><p>API audit history</p></article>
    </div>
    <section class="ops-panel">
      <form class="audit-filter-bar" @submit.prevent="applyFilters">
        <div><label for="filter-state">Signal state</label><select id="filter-state" v-model="filterState"><option v-for="opt in stateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></div>
        <div><label for="filter-trigger">Trigger source</label><select id="filter-trigger" v-model="filterTrigger"><option v-for="opt in triggerOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select></div>
        <div><label for="filter-start">From</label><input id="filter-start" v-model="filterStart" type="datetime-local" /></div>
        <div><label for="filter-end">To</label><input id="filter-end" v-model="filterEnd" type="datetime-local" /></div>
        <AppButton type="submit" size="sm" :loading="loading">Apply</AppButton><AppButton variant="secondary" size="sm" @click="resetFilters">Reset</AppButton>
      </form>
    </section>
    <section class="ops-panel">
      <header class="ops-panel__header"><h2><i class="pi pi-table" />Signal event ledger</h2><span class="ops-tag">{{ events.length }} records on page</span></header>
      <div v-if="loading" class="ops-empty" role="status">Loading audit records…</div>
      <div v-else-if="loadError" class="ops-empty"><i class="pi pi-server" /><p>Audit registry unavailable</p><p class="ops-help">{{ loadError }}</p><AppButton size="sm" variant="secondary" @click="load">Retry connection</AppButton></div>
      <div v-else-if="!events.length" class="ops-empty"><i class="pi pi-inbox" />No audit events match these filters.</div>
      <div v-else class="ops-table-scroll"><table class="ops-table"><thead><tr><th>Event ID</th><th>Timestamp</th><th>Origin / Operator</th><th>Signal state</th><th>Transport</th><th>Payload</th></tr></thead><tbody><tr v-for="log in events" :key="log.id"><td class="mono">{{ log.id.slice(0, 8) }}</td><td class="mono">{{ new Date(log.createdAt).toLocaleString() }}</td><td>{{ actorName(log) }}<small class="audit-subtext">{{ log.triggeredBy === 'auto' ? 'Automatic detection' : 'Operator command' }}</small></td><td><span class="audit-state" :class="stateClass(log.state)">{{ log.state }}</span></td><td class="mono">{{ log.arduinoTransport }}</td><td><AppButton variant="secondary" size="sm" @click="selected = log; copied = false">Inspect</AppButton></td></tr></tbody></table></div>
      <footer class="audit-pagination"><span>Displaying {{ rangeStart }}–{{ rangeEnd }} of {{ loadError ? '—' : total }} records</span><div><AppButton variant="secondary" size="sm" :disabled="page === 1 || loading" @click="goToPage(page - 1)">Prev</AppButton><button v-for="p in visiblePages" :key="p" class="audit-page-button" :class="{ active: p === page }" @click="goToPage(p)">{{ p }}</button><AppButton variant="secondary" size="sm" :disabled="page >= totalPages || loading" @click="goToPage(page + 1)">Next</AppButton></div></footer>
    </section>
    <section class="ops-panel"><header class="ops-panel__header"><h2><i class="pi pi-code" />Raw telemetry payload inspection</h2><div class="ops-actions"><AppButton variant="secondary" size="sm" :disabled="!selected" @click="copyPayload">{{ copied ? 'Copied' : 'Copy JSON' }}</AppButton><AppButton v-if="selected" variant="ghost" size="sm" @click="selected = null">Clear</AppButton></div></header><pre class="ops-json">{{ selected ? JSON.stringify(selected, null, 2) : 'Select Inspect on a recorded event to view its JSON payload.' }}</pre></section>
  </div>
</template>
<style scoped>
.audit-filter-bar { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; padding:18px; }
.audit-filter-bar > div { flex:1; min-width:150px; display:grid; gap:8px; }
.audit-filter-bar label { font-size:10px; color:var(--c-text-muted); font-weight:600; text-transform:uppercase; }
.audit-filter-bar input,.audit-filter-bar select { border:1px solid var(--c-border); min-height:36px; padding:8px 10px; font-size:11px; width:100%; min-width:0; }
.audit-subtext { display:block; color:var(--c-text-muted); margin-top:5px; font-size:10px; }
.audit-state { font:10px var(--font-mono); padding:5px 8px; border-radius:4px; background:var(--ops-inset); }
.state--green { color:var(--c-success); } .state--yellow { color:var(--c-warning); } .state--red { color:var(--c-danger); }
.audit-pagination { display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:18px; font:10px var(--font-mono); color:var(--c-text-muted); border-top:1px solid var(--c-border); }
.audit-pagination > div { display:flex; gap:6px; align-items:center; }
.audit-page-button { background:var(--ops-raised); color:var(--c-text); border:0; border-radius:4px; width:28px; height:28px; cursor:pointer; }
.audit-page-button.active { background:var(--c-primary); color:#fff; }
</style>
