# 🏛️ 上海市养老政策问答智能助手

基于 [Dify](https://dify.ai) Workflow + Node.js 的 AI 养老政策问答网页应用。前端聊天界面，后端安全中转 API，一键部署。

```
用户浏览器 ──▶ Express 中转服务 ──▶ Dify API ──▶ LLM
     ↑              ↑                    ↑
  Markdown 渲染    API Secret 仅存后端    养老政策知识库
  emoji 美化       永不暴露给前端
 代码高亮
```

---

## 🚀 快速开始

```bash
cd server
npm install
cp .env.example .env        # 编辑 .env，填入 Dify API Secret
npm run dev                 # → http://localhost:3000
```

`.env` 只需填两项：

```ini
DIFY_API_BASE=http://localhost/v1    # 你的 Dify 地址
DIFY_API_KEY=app-xxxxxxxxxxxx        # Dify「访问 API」→ API Secret
```

---

## 📁 项目结构

```
├── server/
│   ├── server.js              Express 入口（路由 + 静态托管）
│   ├── services/dify.js       Dify API 封装
│   ├── .env                   密钥（gitignore）
│   └── .env.example           环境变量模板
├── web/
│   ├── index.html             聊天界面
│   ├── app.js                 渲染管线（emoji + Markdown + 高亮）
│   └── lib/                   marked / DOMPurify / highlight.js
└── .gitignore
```

---

## 🔌 API

### `POST /api/chat` — 对话

```json
{ "query": "上海退休年龄是多少？", "conversation_id": "", "user": "user-001" }
```

响应：`data.answer` 为 AI 回复，`data.conversation_id` 用于保持上下文。

### `POST /api/workflow` — 运行 Workflow

```json
{ "inputs": { "keyword": "养老金" }, "user": "user-001" }
```

### `GET /health` — 健康检查

---

## 🌐 部署上线

```bash
# 守护进程
npm install -g pm2
pm2 start server/server.js --name pension-qa
pm2 save && pm2 startup

# Nginx 反代（HTTPS）
```

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;
    location / { proxy_pass http://127.0.0.1:3000; }
}
```

---

## ⚠️ 上线前必做

| 事项 | 位置 |
|---|---|
| 收紧 CORS 为生产域名 | `server/server.js` → `cors({ origin: [...] })` |
| 开启 JWT/OAuth 鉴权 | `.env` → `AUTH_ENABLED=true` |
| 替换演示 Token | `web/app.js` → `TOKEN` |
| 确认 `.env` 未被提交 | `.gitignore` 已包含 `server/.env` |

---

## 🔧 常见问题

| 现象 | 解决 |
|---|---|
| `401 Access token is invalid` | `.env` 中 `DIFY_API_KEY` 与 Dify 控制台不一致 |
| `404` | Dify 应用未「发布」；或 `DIFY_API_BASE` 路径不对 |
| 网页无 emoji | 浏览器 `Ctrl+F5` 强制刷新清除 JS 缓存 |
| 跨域错误 | 收紧 `cors({ origin: [...] })` 为前端域名 |
| 接口超时 | `server/services/dify.js` 调大 `timeout`（默认 120s） |

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | HTML5 + vanilla JS + marked + DOMPurify + highlight.js |
| 后端 | Node.js + Express + axios |
| AI | Dify Workflow / Chatflow API |
| 安全 | API Secret 仅后端持有；DOMPurify XSS 净化；.gitignore 排除密钥 |

---

**完整源码无需外网 CDN**，所有前端库（marked、DOMPurify、highlight.js）已本地化到 `web/lib/`，离线可用。
