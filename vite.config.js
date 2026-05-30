// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    // Pilih port yang tidak dipakai (mis: 3000, 8080, dll.)
    port: 3000,

    // Membolehkan akses dari semua interface jaringan.
    // Jika hanya localhost yang diperlukan, hapus baris ini.
    host: true,

    // Proxy API requests to Bun/Hono backend
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    },

    // Daftar hostname yang di‑izinkan untuk request.
    // Tambahkan nama domain atau IP yang Anda gunakan.
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'agentix.nusa.net.id', // host yang sebelumnya diblokir
    ],
  },
});
