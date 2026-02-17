import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()], // basicSsl() removido para desenvolvimento sem HTTPS
  base: '/',
  server: {
    port: 3000,
    open: true,
    host: true,
    // https: true // Comentado para desenvolvimento - evita CORS com Firebase Storage
  }
})
