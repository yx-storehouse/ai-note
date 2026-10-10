import { defineConfig } from 'vitest/config';

// 测试只覆盖纯逻辑和 Worker 路由，不加载 Cloudflare / Tailwind 插件。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
