import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The 3D property study is the site; the original task list demo
        // stays reachable at /tasks.html.
        main: resolve(import.meta.dirname, 'index.html'),
        tasks: resolve(import.meta.dirname, 'tasks.html'),
      },
    },
  },
})
