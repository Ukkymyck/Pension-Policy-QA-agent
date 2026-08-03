require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { runWorkflow, chat, DIFY_API_BASE } = require('./services/dify');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

app.use(cors()); // 允许跨域；生产环境建议收紧：cors({ origin: ['https://你的前端域名'] })
app.use(express.json({ limit: '2mb' }));

/* ---------------- 简易用户鉴权（示例骨架，按需替换） ---------------- */
// 实际项目中请替换为：JWT 校验 / 微信小程序 wx.login code2session / OAuth
function auth(req, res, next) {
  if (!AUTH_ENABLED) return next(); // 开发阶段先关掉，跑通后再开启

  const token = req.headers['x-user-token'];
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录：请携带 X-User-Token 请求头' });
  }
  // TODO: 在这里校验 token 并解析出真实 userId
  req.user = { id: 'user-' + token.slice(0, 8) };
  next();
}

/* ---------------- 路由 ---------------- */

// 健康检查：部署后先访问它确认服务在线
app.get('/health', (req, res) => {
  res.json({ status: 'ok', difyApiBase: DIFY_API_BASE });
});

// 运行 Workflow（网页 / 小程序 / 业务系统通用）
app.post('/api/workflow', auth, async (req, res) => {
  const { inputs = {}, user } = req.body;
  try {
    const data = await runWorkflow({ inputs, user: user || req.user?.id });
    res.json({ code: 0, data });
  } catch (err) {
    logDifyError(err, '/workflows/run');
    res.status(err.response?.status || 502).json({
      code: -1,
      message: err.response?.data?.message || 'Dify 调用失败，请稍后重试',
    });
  }
});

// Chat 对话（如果你的应用是聊天型）
app.post('/api/chat', auth, async (req, res) => {
  const { query, inputs = {}, conversation_id = '', user } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ code: 400, message: 'query 不能为空' });
  }
  try {
    const data = await chat({ query, inputs, conversation_id, user: user || req.user?.id });
    // data.conversation_id 建议在你的业务库里持久化，关联到当前用户，下次对话带回
    // 去掉模型思考过程 <think>...</think>（Dify 开启思考模式时模型会输出）
    if (typeof data.answer === 'string') {
      data.answer = data.answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }
    res.json({ code: 0, data });
  } catch (err) {
    logDifyError(err, '/chat-messages');
    res.status(err.response?.status || 502).json({
      code: -1,
      message: err.response?.data?.message || 'Dify 调用失败，请稍后重试',
    });
  }
});

/* ---------------- 静态托管网页前端（可选，方便本地联调） ---------------- */
const webDir = path.join(__dirname, '..', 'web');
app.use(express.static(webDir));

/* ---------------- 启动 ---------------- */
app.listen(PORT, () => {
  console.log(`✅ Dify 中转服务已启动: http://localhost:${PORT}`);
  console.log(`   转发到 Dify: ${DIFY_API_BASE}`);
  console.log(`   鉴权: ${AUTH_ENABLED ? '开启' : '关闭（开发模式）'}`);
});

function logDifyError(err, url) {
  if (err.response) {
    console.error(`[dify] ${url} 失败 HTTP ${err.response.status}:`, JSON.stringify(err.response.data));
  } else {
    console.error(`[dify] ${url} 请求异常:`, err.message);
  }
}
