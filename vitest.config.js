import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) }

/**
 * Tests run without the Vite plugins the app builds with: nothing under
 * tests/ renders a component, so Vue's SFC compiler and Tailwind would only
 * cost start-up time. The `@` alias has to match vite.config.js, because the
 * modules under test import each other through it.
 *
 * Two projects, because the two halves of the console run in different places.
 * The browser half reads localStorage, document.title and Notification, so it
 * needs a DOM; the backend resolves paths from `import.meta.url`, which a DOM
 * environment rewrites into an http URL that node:url then refuses.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'browser',
          environment: 'happy-dom',
          include: ['tests/utils/**/*.test.js', 'tests/stores/**/*.test.js', 'tests/api/**/*.test.js'],
          restoreMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'backend',
          environment: 'node',
          include: ['tests/server/**/*.test.js'],
          restoreMocks: true,
        },
      },
    ],
  },
})
