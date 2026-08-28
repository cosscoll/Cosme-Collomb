import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT : remplace "mon-portfolio" par le nom EXACT de ton repo GitHub.
// Si ton repo s'appelle "username.github.io", mets base: '/' à la place.
export default defineConfig({
  plugins: [react()],
  base: '/mon-portfolio/',
})
