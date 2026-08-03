# Dify Workflow 网页接入项目

把你的 Dify Workflow 通过 API 接入网页端。**架构：网页 → 你的后端中转 → Dify API**（API Secret 只存在后端，不暴露给浏览器）。

```
浏览器 (web/)  ──HTTP──▶  后端中转 (server/)  ──HTTP──▶  Dify API (/v1/workflows/run 或 /v1/chat-messages)
```

## 目录结构

```
D:\test\
├── server/                     Node.js 后端中转服务
│   ├── server.js               入口：路由 /api/workflow、/api/chat、/health，并托管 web/
│   ├── services/dify.js        Dify API 封装（axios）
│   ├── package.json
│   ├── package-lock.json       依赖锁定文件（可提交到 git）
│   ├── .env.example            环境变量模板（可提交，只有占位符）
│   └── .env                    真实密钥（已被 .gitignore 忽略，切勿提交！）
├── web/                        网页前端（原生 HTML + JS，无框架）
│   ├── index.html              聊天对话界面
│   ├── app.js                  前端逻辑 + Markdown 渲染管线 + emoji 美化
│   └── lib/                    浏览器端插件（本地引入，不依赖外网 CDN）
│       ├── marked.min.js       Markdown → HTML 渲染引擎
│       ├── purify.min.js       DOMPurify XSS 安全净化
│       └── hljs/               highlight.js 代码语法高亮
│           ├── highlight.min.js
│           ├── github.min.css   GitHub 风格浅色主题
│           └── languages/      27 个常用语言（js/py/sql/go/rust/...）
├── .gitignore                  忽略 node_modules/、.env、日志等
└── README.md
```

## 快速开始（本地开发）

```bash
# 1. 进入 server 目录，安装依赖
cd D:\test\server
npm install

# 2. 配置环境变量
#    复制 .env.example 为 .env，填入：
#    DIFY_API_KEY = Dify 控制台 → 应用「访问 API」页面的 API Secret（app- 开头）
cp .env.example .env   # Windows: copy .env.example .env

# 3. 启动（开发模式，文件改动自动重启）
npm run dev
# 或生产模式
npm start
```

启动后：

1. 浏览器打开 **http://localhost:3000**，即网页演示页
2. 在「运行 Workflow」里填 `inputs` 的 JSON（**变量名要和 Dify 里 Workflow 的输入变量完全一致**），点运行
3. 先访问 **http://localhost:3000/health** 确认服务在线

## 前置条件（重要）

- ✅ Dify 里的 Workflow 必须已点击 **「发布」**，否则调用 `/v1/workflows/run` 会报 404
- ✅ `inputs` 的字段名必须与 Dify Workflow 的输入变量一致，否则 Dify 报参数错误
- ✅ 自部署 Dify 时，`DIFY_API_BASE` 填 `https://你的dify域名/v1`

## API 说明

### POST /api/workflow — 运行 Workflow（阻塞式）

请求：

```json
{
  "inputs": { "keyword": "奶茶", "count": 3 },
  "user": "user-001"
}
```

响应（`data` 即 Dify 原始返回，结果在 `data.outputs`，字段名 = Dify 里设置的输出变量名）：

```json
{
  "code": 0,
  "data": {
    "workflow_run_id": "xxx",
    "data": {
      "outputs": { "result": "..." },
      "status": "succeeded",
      "elapsed_time": 3.2,
      "total_tokens": 1000
    }
  }
}
```

### POST /api/chat — Chat 对话（聊天型应用）

> ⚠️ 前提：`/v1/chat-messages` 只支持 Dify 的**聊天助手 / Chatflow** 类型应用。
> 如果你的应用是**纯 Workflow** 类型，请把 `web/app.js` 里的 `APP_MODE` 改为 `'workflow'`，问题会走 `/api/workflow` 并作为 `inputs` 传入。

请求：

```json
{
  "query": "帮我写一封请假邮件",
  "conversation_id": "",   // 首次为空；之后传回上次返回的 conversation_id 保持上下文
  "user": "user-001"
}
```

响应：回答在 `data.answer`，`data.conversation_id` 需由你的业务系统持久化。

### GET /health — 健康检查

## 部署上线

### 1. 后端

```bash
# 推荐用 pm2 守护进程
npm install -g pm2
pm2 start server.js --name dify-relay
pm2 save && pm2 startup
```

### 2. HTTPS 域名（必须）

- 用 nginx 反代 `server.js` 并配置 SSL 证书，例如：

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 前端

- **同源**：`web/` 已由 server 静态托管，部署后端即部署前端（`web/app.js` 中 `API_BASE` 留空）
- **前后端分离**：把 `web/` 部署到 nginx / OSS / 对象存储，并把 `web/app.js` 里的 `API_BASE` 改成 `https://api.yourdomain.com`

### 4. 上线前必须做的事

| 事项 | 位置 |
|---|---|
| CORS 收紧为你的前端域名 | `server/server.js` 里的 `cors()` |
| 开启鉴权并替换为真实登录校验（JWT/OAuth） | `.env` 设 `AUTH_ENABLED=true`，改 `server.js` 的 `auth` 中间件 |
| 前端 `web/app.js` 的 `TOKEN` 换成真实登录 token | `web/app.js` |
| 长任务调大超时（默认 120s） | `server/services/dify.js` 的 `timeout` |
| 把 `.env` 加入 `.gitignore`，密钥别进代码仓库 | |

## 常见问题

| 现象 | 原因 / 解决 |
|---|---|
| 调用 `/api/chat` 返回 404 | Dify 应用不是聊天助手/Chatflow 类型：把 `web/app.js` 的 `APP_MODE` 改为 `'workflow'`（并设置 `APP_INPUT_KEY` 为你 Workflow 的输入变量名） |
| 调用 `/api/workflow` 返回 502 | 后端连不上 Dify：检查 `DIFY_API_BASE` / `DIFY_API_KEY` / 服务器网络 |
| Dify 返回 404 | Workflow 未「发布」；或 `DIFY_API_BASE` 路径不是 `/v1` 结尾 |
| 400 参数错误 | `inputs` 的字段名 / 类型与 Dify Workflow 输入变量不一致 |
| 浏览器跨域报错 | 用 `https://你的前端域名` 访问时被 CORS 拦截：收紧 `cors({ origin: [...] })` |
| 接口通了但结果超时 | Workflow 执行超过 120 秒：调大 `timeout`，或改用 streaming 流式模式 |
| 401 未登录 | 开发阶段在 `.env` 设 `AUTH_ENABLED=false`，上线再开 |

## 后续可扩展

- **流式输出**（打字机效果）：把 `response_mode` 改为 `streaming`，后端用 SSE 转发
- **对话记录**：把 `conversation_id` 和消息内容存进数据库
- **限流**：在 `auth` 中间件后面加 per-user 限流，防止刷接口烧 token
