import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import pkg from './package.json' with { type: 'json' };

// `npm run dev` 会在 workerd 中运行 worker/index.ts，/api/* 与线上行为一致。
// 本地密钥写在 .dev.vars（参考 .dev.vars.example）。
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 3000,
  },
});
