import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const inTests = Boolean(process.env.VITEST)

/**
 * The Content-Security-Policy the app is served with (docs/10-deployment.md repeats it for Vercel and Netlify).
 * `vite preview` applies it too, so the end-to-end tests fail if the app ever needs something it forbids. Only the
 * Supabase project (REST, auth, functions, realtime) may be talked to; styles may be inline (Radix and Recharts
 * set style attributes); nothing may frame the app.
 */
function contentSecurityPolicy(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).host
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' https://${host} wss://${host}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Without a URL (a fresh checkout previewing before configuring) fall back to any Supabase project.
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://project.supabase.co'

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: inTests,
        // A new version is offered to the person ("Update") instead of swapping the app under an open form.
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          id: '/',
          name: 'Ajyal Academy · أكاديمية أجيال',
          short_name: 'Ajyal',
          description:
            'Manage players, subscriptions, sessions and attendance · إدارة اللاعبين والاشتراكات والحصص والحضور',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          // The brand tokens `brand-blue` and `page` (src/styles/index.css).
          theme_color: '#1860c8',
          background_color: '#f3f6fc',
          icons: [
            { src: '/brand/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: '/brand/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/brand/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/brand/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // The app shell only: scripts, styles, fonts, icons. Supabase (another origin) is never cached, so
          // player and money data never sits in a service-worker cache.
          globPatterns: ['**/*.{js,css,html,woff2,png,ico,jpg,svg}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    preview: {
      headers: {
        'Content-Security-Policy': contentSecurityPolicy(supabaseUrl),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // Playwright specs live in e2e/ and run with `npm run e2e`.
      exclude: ['e2e/**', 'node_modules/**'],
      // The service worker does not exist under test; the plugin's virtual module is replaced by a stub.
      alias: {
        'virtual:pwa-register/react': fileURLToPath(
          new URL('./src/test/pwa-register-stub.ts', import.meta.url),
        ),
      },
      // Tests never reach the network; these only let `src/lib/supabase.ts` be imported.
      env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-key' },
    },
  }
})
