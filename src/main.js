import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useConnectionStore } from './stores/connection'
import { useUiStore } from './stores/ui'
import { installI18n } from './i18n'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  useUiStore(pinia).applyTheme()
  installI18n(app)

  // The session lives in the backend, so it has to be resolved before the first
  // navigation guard runs — otherwise a reload bounces a live session to /login.
  await useConnectionStore(pinia).init()

  app.use(router)
  app.mount('#app')
}

bootstrap()
