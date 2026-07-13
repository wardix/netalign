import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('cytoscape') || id.includes('react-cytoscapejs')) {
    return 'vendor-cytoscape'
  }

  if (id.includes('/@rc-component/')) {
    return 'vendor-rc'
  }

  if (id.includes('/antd/') || id.includes('/@ant-design/')) {
    return 'vendor-antd'
  }

  if (id.includes('/react-dom/') || id.includes('/react/')) {
    return 'vendor-react'
  }

  return 'vendor-misc'
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunk(id)
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'agentix.nusa.net.id',
    ],
  },
})