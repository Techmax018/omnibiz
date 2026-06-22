import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'pdf-libs'
          }
          if (id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
