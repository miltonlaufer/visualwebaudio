import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Visual Web Audio',
        short_name: 'VWAudio',
        description: 'Interactive Web Audio API Visualizer',
        theme_color: '#000000',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  base: './', // Use relative paths for assets
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React and React DOM
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          // MobX state management
          if (id.includes('node_modules/mobx')) {
            return 'mobx-vendor'
          }
          // React Flow library
          if (id.includes('node_modules/@xyflow')) {
            return 'reactflow-vendor'
          }
          // LangChain AI libraries (largest dependencies)
          if (id.includes('node_modules/@langchain') || id.includes('node_modules/langchain')) {
            return 'langchain-vendor'
          }
          // UI libraries
          if (id.includes('node_modules/@headlessui') || id.includes('node_modules/@heroicons')) {
            return 'ui-vendor'
          }
          // Syntax highlighter (large)
          if (id.includes('node_modules/react-syntax-highlighter')) {
            return 'syntax-highlighter'
          }
          // Other utilities
          if (id.includes('node_modules/dexie') || id.includes('node_modules/crypto-js')) {
            return 'utils-vendor'
          }
        },
      },
    },
    // Higher limit since large chunks (langchain, syntax-highlighter) are lazy-loaded
    chunkSizeWarningLimit: 700,
  },
})
