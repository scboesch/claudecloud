import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the viewer as one self-contained JS + CSS pair, for embedding the
// whole site into a single HTML file.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: 'index.html',
      output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
})
