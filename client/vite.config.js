import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-charts':   ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion':   ['motion'],
          'vendor-radix': [
            '@radix-ui/react-accordion', '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',    '@radix-ui/react-popover',
            '@radix-ui/react-progress',  '@radix-ui/react-select',
            '@radix-ui/react-separator', '@radix-ui/react-slider',
            '@radix-ui/react-slot',      '@radix-ui/react-switch',
            '@radix-ui/react-tabs',      '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
})
