import { createRouter, createWebHistory } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import AppShell from '@/components/AppShell.vue'
import LoginView from '@/views/LoginView.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true, title: 'Connect' } },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'servers',
        name: 'servers',
        component: () => import('@/views/ServersView.vue'),
        meta: { title: 'Servers' },
      },
      {
        path: 'clusters',
        name: 'clusters',
        component: () => import('@/views/ClustersView.vue'),
        meta: { title: 'Clusters' },
      },
      {
        path: 'deployments',
        name: 'deployments',
        component: () => import('@/views/DeploymentsView.vue'),
        meta: { title: 'Deployments' },
      },
      {
        path: 'data-sources',
        name: 'data-sources',
        component: () => import('@/views/DataSourcesView.vue'),
        meta: { title: 'Data Sources' },
      },
      { path: 'jms', name: 'jms', component: () => import('@/views/JmsView.vue'), meta: { title: 'JMS' } },
      {
        path: 'monitoring',
        name: 'monitoring',
        component: () => import('@/views/MonitoringView.vue'),
        meta: { title: 'Monitoring' },
      },
      { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue'), meta: { title: 'Logs' } },
      {
        path: 'explorer',
        name: 'explorer',
        component: () => import('@/views/ExplorerView.vue'),
        meta: { title: 'REST Explorer' },
      },
      {
        path: 'connections',
        name: 'connections',
        component: () => import('@/views/ConnectionsView.vue'),
        meta: { title: 'Connections' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const connection = useConnectionStore()
  if (to.meta.public) {
    const addingAnother = to.name === 'login' && to.query.add
    return connection.connected && to.name === 'login' && !addingAnother ? { name: 'dashboard' } : true
  }
  if (!connection.connected) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  const suffix = 'WebLogic Console'
  document.title = to.meta.title ? `${to.meta.title} · ${suffix}` : suffix
})

export default router
