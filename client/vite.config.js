import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'hero.png'],
      manifest: {
        name: 'Lemida School Manager',
        short_name: 'Lemida',
        description: 'School management system for attendance, fees, results and more',
        theme_color: '#4f46e5',
        background_color: '#fffbeb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          // Cache-first for static API data: classes, students, subjects, timetable
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/classes') ||
              url.pathname.startsWith('/subjects') ||
              url.pathname.startsWith('/timetable') ||
              url.pathname.startsWith('/sessions'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-static-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          // Network-first for frequently changing data: students, fees, attendance
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/students') ||
              url.pathname.startsWith('/attendance') ||
              url.pathname.startsWith('/fees') ||
              url.pathname.startsWith('/scores') ||
              url.pathname.startsWith('/parents'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-dynamic-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 8, // 8 hours
              },
            },
          },
        ],
        // Precache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache auth-related API calls
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false, // Disable in dev to avoid caching issues during development
      },
    }),
  ],
})
