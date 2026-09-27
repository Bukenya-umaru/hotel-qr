import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), '').VITE_API_URL || 'http://localhost:4000'
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
  }
})
