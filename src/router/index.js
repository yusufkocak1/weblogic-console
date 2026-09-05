import { createRouter, createWebHistory } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { setTitleBase } from '@/utils/title'
import { t } from '@/i18n'
import AppShell from '@/components/AppShell.vue'
import LoginView from '@/views/LoginView.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true, title: () => t('Connect') } },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: { name: 'dashboard' } },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: () => t('Dashboard') },
      },
      {
        path: 'servers',
        name: 'servers',
        component: () => import('@/views/ServersView.vue'),
        meta: { title: () => t('Servers') },
      },
      {
        path: 'servers/:name',
        name: 'server-detail',
        component: () => import('@/views/ServerDetailView.vue'),
        meta: { title: () => t('Server') },
      },
      {
        path: 'clusters',
        name: 'clusters',
        component: () => import('@/views/ClustersView.vue'),
        meta: { title: () => t('Clusters') },
      },
      {
        path: 'clusters/:name',
        name: 'cluster-detail',
        component: () => import('@/views/ClusterDetailView.vue'),
        meta: { title: () => t('Cluster') },
      },
      {
        path: 'deployments',
        name: 'deployments',
        component: () => import('@/views/DeploymentsView.vue'),
        meta: { title: () => t('Deployments') },
      },
      {
        path: 'deployments/:name',
        name: 'deployment-detail',
        component: () => import('@/views/DeploymentDetailView.vue'),
        meta: { title: () => t('Application') },
      },
      {
        path: 'data-sources',
        name: 'data-sources',
        component: () => import('@/views/DataSourcesView.vue'),
        meta: { title: () => t('Data Sources') },
      },
      {
        path: 'data-sources/:name',
        name: 'data-source-detail',
        component: () => import('@/views/DataSourceDetailView.vue'),
        meta: { title: () => t('Data source') },
      },
      { path: 'jms', name: 'jms', component: () => import('@/views/JmsView.vue'), meta: { title: () => t('JMS') } },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/views/TransactionsView.vue'),
        meta: { title: () => t('Transactions') },
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/SecurityView.vue'),
        meta: { title: () => t('Security') },
      },
      {
        path: 'compare',
        name: 'compare',
        component: () => import('@/views/CompareView.vue'),
        meta: { title: () => t('Compare domains') },
      },
      {
        // Settings live on the page of the thing they configure, so the domain's
        // own settings hang off the Dashboard rather than a menu entry.
        path: 'domain',
        name: 'domain-settings',
        component: () => import('@/views/DomainSettingsView.vue'),
        meta: { title: () => t('Domain settings') },
      },
      {
        path: 'monitoring',
        name: 'monitoring',
        component: () => import('@/views/MonitoringView.vue'),
        meta: { title: () => t('Monitoring') },
      },
      { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue'), meta: { title: () => t('Logs') } },
      {
        path: 'explorer',
        name: 'explorer',
        component: () => import('@/views/ExplorerView.vue'),
        meta: { title: () => t('REST Explorer') },
      },
      {
        path: 'connections',
        name: 'connections',
        component: () => import('@/views/ConnectionsView.vue'),
        meta: { title: () => t('Connections') },
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
  const page = to.meta.title?.() || ''
  setTitleBase(to.params.name ? `${to.params.name} · ${page}` : page)
})

export default router
