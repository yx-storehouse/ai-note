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
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 返回配置信息（不包含敏感信息）
    if (url.pathname === '/api/config') {
      return new Response(
        JSON.stringify({
          modelName: env.MIMO_MODEL_NAME || 'mimo-1',
          giteeToken: env.GITEE_TOKEN || '',
          gistId: env.GITEE_GIST_ID || '',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // 代理 /api/mimo 到 MIMO API
    if (url.pathname === '/api/mimo' || url.pathname.startsWith('/api/mimo')) {
      try {
        // 从环境变量读取 API Key（更安全，不会暴露给用户）
        const apiKey = env.MIMO_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: { message: 'MIMO API Key not configured in Worker environment variables' } }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            },
          );
        }

        const requestBody = await request.json();
        
        // 从环境变量读取模型名称，如果没有则使用请求中的模型名称
        const modelName = env.MIMO_MODEL_NAME || requestBody.model || 'mimo-1';
        requestBody.model = modelName;

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
            'Access-Control-Allow-Headers': 'Content-Type',
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

    // 其他路径交给静态资源处理（SPA 路由支持）
    if (env.ASSETS) {
      // 对于 SPA，所有非 API 和非静态资源的请求都返回 index.html
      const assetResponse = await env.ASSETS.fetch(request);
      
      // 如果是 404 且不是 API 路径，返回 index.html（SPA 路由）
      if (assetResponse.status === 404 && !url.pathname.startsWith('/api')) {
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        const indexResponse = await env.ASSETS.fetch(indexRequest);
        if (indexResponse.status === 200) {
          return indexResponse;
        }
      }
      
      return assetResponse;
    }

    return new Response('Not found', { status: 404 });
  },
};

