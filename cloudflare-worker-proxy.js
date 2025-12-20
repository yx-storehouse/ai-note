/**
 * Cloudflare Workers 代理脚本
 * 用于解决生产环境的 CORS 跨域问题
 * 
 * 在 Workers & Pages 一体化项目中使用：
 * - 构建静态资源到 dist/
 * - 通过 wrangler.toml 的 [assets] 配置挂载静态资源
 * - 本 Worker 只处理 /api/mimo，其余请求转发给静态资源服务
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 处理预检请求（CORS）
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, api-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 代理 /api/mimo 到 MIMO API
    if (url.pathname === '/api/mimo' || url.pathname.startsWith('/api/mimo')) {
      try {
        const apiKey = request.headers.get('api-key');
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: { message: 'Missing api-key header' } }),
            {
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            },
          );
        }

        const requestBody = await request.json();

        const mimoResponse = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await mimoResponse.text();

        return new Response(responseText, {
          status: mimoResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, api-key',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: { message: error.message || 'Proxy error' } }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        );
      }
    }

    // 其他路径交给静态资源处理
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};

