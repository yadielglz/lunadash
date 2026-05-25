import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
          motion: ['framer-motion'],
          grid: ['react-grid-layout', 'react-resizable'],
          date: ['date-fns'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
