import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:7101'

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // The UI never talks to WebLogic directly — it calls the local backend
    // (server/index.mjs), which holds the connection and proxies to whichever
    // AdminServer was entered on the login screen. In production that same
    // backend serves the built files, so this proxy is dev-only.
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 900,
    },
  }
})
