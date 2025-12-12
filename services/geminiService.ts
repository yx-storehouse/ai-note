import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey });

export const analyzeText = async (text: string): Promise<AnalysisResponse> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const prompt = `
    你是一位专家级的数据整理和DevOps助手。
    请分析提供的原始文本，其中可能包含服务器配置、命令、凭据、URL链接或个人笔记等混合内容。
    
    你的目标是将这些原始文本拆分成清晰、合乎逻辑的独立“笔记”。
    例如，如果文本包含一个 VPS 配置，然后是另一段挂载命令，这应该是两个分开的笔记。

    对于每个笔记：
    1. 给出一个简洁的中文 'title'。
    2. 写一个一句话的中文 'summary'（摘要）。
    3. 从以下列表中分配一个 'category'（分类）：服务器, 网络, 命令, 凭据, 配置, 链接, 其他。
    4. 生成相关的 'tags'（标签）。
    5. 将关键细节提取到 'fields'（字段）中（例如：用户名、IP、端口）。将 'label' 设为中文。对于技术字符串（如IP、路径）将 'isCode' 设为 true。对于密码/Token 将 'isSecret' 设为 true。
    6. 将多行脚本或命令提取到 'codeBlocks'。

    仅返回符合 schema 的 JSON 对象。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: `Raw Text to Process:\n${text}` }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  category: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  fields: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        value: { type: Type.STRING },
                        isCode: { type: Type.BOOLEAN },
                        isSecret: { type: Type.BOOLEAN },
                      }
                    }
                  },
                  codeBlocks: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(response.text) as AnalysisResponse;

  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};