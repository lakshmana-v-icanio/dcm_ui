import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/DMS/awc/pcmgr/beta/',

  plugins: [react()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,

    rollupOptions: {
      output: {
        entryFileNames: 'assets/pc_manager.js',
        chunkFileNames: 'assets/pc_manager-[name].js',

        assetFileNames: (info) => {
          if (info.names?.some((name) => name.endsWith('.css'))) {
            return 'assets/pc_manager.css'
          }

          return 'assets/[name][extname]'
        },
      },
    },
  },
})