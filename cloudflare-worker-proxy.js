/**
 * Cloudflare Workers 代理脚本
 * 用于解决生产环境的 CORS 跨域问题
 * 
 * 部署步骤：
 * 1. 在 Cloudflare Dashboard 中创建新的 Worker
 * 2. 将此代码复制到 Worker 编辑器中
 * 3. 保存并部署
 * 4. 在应用设置中将 API Endpoint 设置为你的 Worker URL，例如：
 *    https://your-worker-name.your-subdomain.workers.dev/api/mimo
 */

export default {
  async fetch(request, env, ctx) {
    // 只处理 POST 请求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 获取请求的路径
    const url = new URL(request.url);
    
    // 如果路径是 /api/mimo，则代理到 MIMO API
    if (url.pathname === '/api/mimo' || url.pathname.startsWith('/api/mimo')) {
      try {
        // 获取原始请求体
        const requestBody = await request.json();
        
        // 获取 api-key 请求头
        const apiKey = request.headers.get('api-key');
        
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: { message: 'Missing api-key header' } }),
            { 
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        // 转发请求到 MIMO API
        const mimoResponse = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        });

        // 获取响应数据
        const responseData = await mimoResponse.json();

        // 返回响应，添加 CORS 头
        return new Response(JSON.stringify(responseData), {
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
          JSON.stringify({ error: { message: error.message } }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, api-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};

