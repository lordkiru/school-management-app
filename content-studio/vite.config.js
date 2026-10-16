import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Port 5174 so it can run next to the SchoolManager client (5173) while developing.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
})
