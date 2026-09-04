import { createRouter, createWebHistory } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { setTitleBase } from '@/utils/title'
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
        path: 'servers/:name',
        name: 'server-detail',
        component: () => import('@/views/ServerDetailView.vue'),
        meta: { title: 'Server' },
      },
      {
        path: 'clusters',
        name: 'clusters',
        component: () => import('@/views/ClustersView.vue'),
        meta: { title: 'Clusters' },
      },
      {
        path: 'clusters/:name',
        name: 'cluster-detail',
        component: () => import('@/views/ClusterDetailView.vue'),
        meta: { title: 'Cluster' },
      },
      {
        path: 'deployments',
        name: 'deployments',
        component: () => import('@/views/DeploymentsView.vue'),
        meta: { title: 'Deployments' },
      },
      {
        path: 'deployments/:name',
        name: 'deployment-detail',
        component: () => import('@/views/DeploymentDetailView.vue'),
        meta: { title: 'Application' },
      },
      {
        path: 'data-sources',
        name: 'data-sources',
        component: () => import('@/views/DataSourcesView.vue'),
        meta: { title: 'Data Sources' },
      },
      {
        path: 'data-sources/:name',
        name: 'data-source-detail',
        component: () => import('@/views/DataSourceDetailView.vue'),
        meta: { title: 'Data source' },
      },
      { path: 'jms', name: 'jms', component: () => import('@/views/JmsView.vue'), meta: { title: 'JMS' } },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/views/TransactionsView.vue'),
        meta: { title: 'Transactions' },
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/SecurityView.vue'),
        meta: { title: 'Security' },
      },
      {
        path: 'compare',
        name: 'compare',
        component: () => import('@/views/CompareView.vue'),
        meta: { title: 'Compare domains' },
      },
      {
        // Settings live on the page of the thing they configure, so the domain's
        // own settings hang off the Dashboard rather than a menu entry.
        path: 'domain',
        name: 'domain-settings',
        component: () => import('@/views/DomainSettingsView.vue'),
        meta: { title: 'Domain settings' },
      },
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
  // A detail page is named after the object it shows, not after its type.
  // setTitleBase keeps whatever badge the alert watcher has put in front.
  setTitleBase(to.params.name ? `${to.params.name} · ${to.meta.title}` : to.meta.title)
})

export default router
