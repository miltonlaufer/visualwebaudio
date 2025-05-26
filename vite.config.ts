import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for assets
  resolve: {
    alias: {
      '~': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React and React DOM
          'react-vendor': ['react', 'react-dom'],
          // MobX state management
          'mobx-vendor': ['mobx', 'mobx-react-lite', 'mobx-state-tree'],
          // React Flow library
          'reactflow-vendor': ['@xyflow/react'],
        },
      },
    },
    // Increase chunk size warning limit to 1MB since we're now splitting chunks
    chunkSizeWarningLimit: 1000,
  },
})
