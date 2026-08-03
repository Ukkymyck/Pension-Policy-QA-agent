require('dotenv').config();
const axios = require('axios');

const DIFY_API_BASE = process.env.DIFY_API_BASE || 'https://api.dify.ai/v1';
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';

if (!DIFY_API_KEY || DIFY_API_KEY.startsWith('app-xxxx')) {
  console.warn('[dify] ⚠️ 未配置 DIFY_API_KEY，请在 server/.env 中填入你的 API Secret');
}

const client = axios.create({
  baseURL: DIFY_API_BASE,
  timeout: 120000, // 长任务 Workflow 可能需要 2 分钟以上，按需调整
  headers: {
    Authorization: `Bearer ${DIFY_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

/**
 * 运行 Workflow（阻塞式，等 Dify 跑完再返回完整结果）
 * @param {{inputs: object, user: string}} params
 * @returns Dify 返回体，结果在 data.outputs 中
 */
async function runWorkflow({ inputs = {}, user = 'default-user' }) {
  const { data } = await client.post('/workflows/run', {
    inputs,
    response_mode: 'blocking',
    user,
  });
  return data;
}

/**
 * Chat 对话（阻塞式），传 conversation_id 可保持上下文
 * @param {{query: string, inputs: object, user: string, conversation_id: string}} params
 * @returns Dify 返回体，回答在 data.answer 中
 */
async function chat({ query, inputs = {}, user = 'default-user', conversation_id = '' }) {
  const { data } = await client.post('/chat-messages', {
    inputs,
    query,
    response_mode: 'blocking',
    user,
    conversation_id,
  });
  return data;
}

module.exports = { runWorkflow, chat, DIFY_API_BASE };
