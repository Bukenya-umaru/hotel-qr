import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), '').VITE_API_URL || 'http://localhost:4000'
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/recharts/') || /node_modules\/d3-/.test(id)) return 'charts'
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) return 'react-vendor'
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
        '/socket.io': {
          target: apiTarget,
          ws: true,
        },
      },
    },
  }
})
