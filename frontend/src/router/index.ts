import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { authDisabled } from '../utils/preview';

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  {
    path: '/', component: () => import('../components/AppLayout.vue'), meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/SystemSettingsView.vue'), meta: { requiresAdmin: true } },
      { path: 'diagnostics', name: 'diagnostics', component: () => import('../views/DiagnosticsView.vue') },
      { path: 'manual', name: 'manual', component: () => import('../views/ManualPage.vue') },
      { path: 'testing', name: 'testing', component: () => import('../views/TestingView.vue'), meta: { requiresAdmin: true } },
      { path: 'audit-logs', name: 'audit-logs', component: () => import('../views/AuditLogsView.vue'), meta: { requiresAdmin: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (authDisabled) {
    if (to.name === 'login') return { name: 'dashboard' };
    return true;
  }

  const auth = useAuthStore();

  if (!auth.ready) {
    await auth.refresh();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'dashboard' };
  }

  if (to.meta.public && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
