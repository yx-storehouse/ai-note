// 构建后清理脚本：删除 dist 目录中的 _redirects 文件
// 因为路由由 Worker 处理，不需要 _redirects 文件

import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const redirectsPath = join(process.cwd(), 'dist', '_redirects');

if (existsSync(redirectsPath)) {
  try {
    unlinkSync(redirectsPath);
    console.log('✓ Removed _redirects file from dist directory');
  } catch (error) {
    console.error('Failed to remove _redirects file:', error);
    process.exit(1);
  }
} else {
  console.log('✓ No _redirects file found (already clean)');
}

