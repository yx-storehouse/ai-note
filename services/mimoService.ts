import { AnalysisResponse } from "../types";

// 小米 MIMO 大模型 API 调用
// 注意：请根据实际的 MIMO API 文档调整 endpoint 和请求格式
export const analyzeText = async (text: string, apiKey: string | null, apiEndpoint?: string, modelName?: string): Promise<AnalysisResponse> => {
  // 默认使用通用的 OpenAI 兼容格式，如果 MIMO API 格式不同，请根据实际文档修改
  // 官方文档（OpenAI 格式）端点: https://api.xiaomimimo.com/v1/chat/completions
  // 参考: https://platform.xiaomimimo.com/#/docs/quick-start/first-api-call
  
  // 开发环境使用 Vite 代理解决 CORS 问题，生产环境使用 Worker 代理（API Key 在 Worker 中）
  const isDev = import.meta.env.DEV;
  const defaultEndpoint = isDev 
    ? '/api/mimo'  // 开发环境使用 Vite 代理
    : '/api/mimo';  // 生产环境使用 Worker 代理（同域，无需 CORS）
  
  const endpoint = apiEndpoint?.trim() || defaultEndpoint;
  
  // 开发环境需要 API Key（从用户输入），生产环境不需要（Worker 中已配置）
  if (isDev && (!apiKey || apiKey.trim().length === 0)) {
    throw new Error("开发环境需要配置 API Key，请在设置中输入");
  }
  
  const prompt = `
    你是一位专家级的数据整理和DevOps助手。
    请分析提供的原始文本，其中可能包含服务器配置、命令、凭据、URL链接或个人笔记等混合内容。
    
    你的目标是将这些原始文本拆分成清晰、合乎逻辑的独立"笔记"。
    例如，如果文本包含一个 VPS 配置，然后是另一段挂载命令，这应该是两个分开的笔记。

    对于每个笔记：
    1. 给出一个简洁的中文 'title'。
    2. 写一个一句话的中文 'summary'（摘要）。
    3. 从以下列表中分配一个 'category'（分类）：服务器, 网络, 命令, 凭据, 配置, 链接, 其他。
    4. 生成相关的 'tags'（标签）。
    5. 将关键细节提取到 'fields'（字段）中（例如：用户名、IP、端口）。将 'label' 设为中文。对于技术字符串（如IP、路径）将 'isCode' 设为 true。对于密码/Token 将 'isSecret' 设为 true。
    6. 将多行脚本或命令提取到 'codeBlocks'。

    请严格按照以下 JSON 格式返回，不要包含任何其他文本：
    {
      "notes": [
        {
          "title": "笔记标题",
          "summary": "笔记摘要",
          "category": "分类",
          "tags": ["标签1", "标签2"],
          "fields": [
            {
              "label": "字段名",
              "value": "字段值",
              "isCode": false,
              "isSecret": false
            }
          ],
          "codeBlocks": ["代码块1", "代码块2"]
        }
      ]
    }
  `;

  try {
    console.log('调用 MIMO API:', { endpoint, apiKeyLength: apiKey.length });
    
    // 使用 OpenAI 兼容格式调用 API
    // 根据 MIMO API 文档调整参数
    const requestBody: any = {
      model: modelName || 'mimo-1', // 默认模型名称，可以在设置中自定义
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `原始文本内容：\n${text}`
        }
      ],
      temperature: 0.7,
    };
    
    // 注意：某些 API 可能不支持 response_format 参数
    // 如果遇到 "Param Incorrect" 错误，尝试移除 response_format
    // 如果 API 支持 JSON 模式，可以取消下面的注释
    // requestBody.response_format = { type: 'json_object' };

    console.log('请求体:', JSON.stringify(requestBody, null, 2));

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // 开发环境需要传递 API Key，生产环境由 Worker 处理
    if (isDev && apiKey) {
      headers['api-key'] = apiKey;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('响应状态:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status} ${response.statusText}`;
      let errorDetails = '';
      
      try {
        const errorData = await response.json();
        console.error('错误响应:', errorData);
        errorDetails = errorData.error?.message || errorData.message || '';
        if (errorDetails) {
          errorMessage = `${errorMessage}\n详情: ${errorDetails}`;
        }
      } catch (e) {
        try {
          const errorText = await response.text();
          console.error('错误文本:', errorText);
          if (errorText) {
            errorDetails = errorText.substring(0, 200); // 限制长度
            errorMessage = `${errorMessage}\n详情: ${errorDetails}`;
          }
        } catch (textError) {
          // 无法读取错误文本
        }
      }
      
      // 提供更具体的错误提示
      if (response.status === 401 || response.status === 403) {
        throw new Error(`认证失败 (${response.status}): 请检查 API Key 是否正确\n端点: ${endpoint}`);
      } else if (response.status === 404) {
        throw new Error(`API 端点不存在 (404): 请检查 API Endpoint 是否正确\n当前端点: ${endpoint}\n\n提示: 如果使用自定义 API，请确保端点格式正确`);
      } else if (response.status >= 500) {
        throw new Error(`服务器错误 (${response.status}): API 服务可能暂时不可用\n端点: ${endpoint}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // 解析响应内容
    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;
    } else if (data.content) {
      content = data.content;
    } else {
      throw new Error("API 响应格式不正确");
    }

    // 尝试解析 JSON
    let parsedResponse: AnalysisResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      // 如果响应不是纯 JSON，尝试提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("无法解析 AI 返回的 JSON 数据");
      }
    }

    // 验证响应格式
    if (!parsedResponse.notes || !Array.isArray(parsedResponse.notes)) {
      throw new Error("AI 返回的数据格式不正确");
    }

    return parsedResponse;

  } catch (error: any) {
    console.error("MIMO AI 分析失败:", error);
    
    // 提供更详细的错误信息
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`网络请求失败: 无法连接到 API 服务器\n可能的原因:\n1. API Endpoint 不正确\n2. CORS 跨域问题\n3. 网络连接问题\n\n当前端点: ${endpoint}\n\n请检查 API Endpoint 设置或联系 API 服务提供商`);
    }
    
    throw new Error(error.message || "AI 分析失败，请检查 API Key 或网络连接");
  }
};

