import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The root index.html is the already-compiled GitHub Pages entrypoint.
// Vite builds from a separate editable source, so branch-based Pages cannot
// accidentally publish the uncompiled /src/main.jsx again.
export default defineConfig({
  plugins: [react()],
  base: '/Cosme-Collomb/',
  build: {
    rollupOptions: {
      input: {
        portfolio: fileURLToPath(new URL('./index.source.html', import.meta.url)),
        prototype3d: fileURLToPath(new URL('./prototype-3d/index.source.html', import.meta.url))
      }
    }
  }
})
