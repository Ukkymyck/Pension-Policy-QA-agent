// ===================== 配置区 =====================
const API_BASE = '';              // 同源部署留空；前后端分离时填 https://你的后端域名
const TOKEN = 'demo-token-123';   // 演示 token；上线前换成真实鉴权 token
// ==================================================

let conversationId = '';
let sending = false;

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const btnSend = document.getElementById('btnSend');
const welcomeEl = document.getElementById('welcome');
const convMetaEl = document.getElementById('convMeta');

// 回车发送
inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

/* 渲染管线：polishMarkdown → marked → DOMPurify → hljs → 表格竖排 */

/* ========== 工具函数 ========== */

/** 调自己的后端，由后端转发给 Dify */
async function callApi(path, body) {
  var res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Token': TOKEN },
    body: JSON.stringify(body),
  });
  var json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '请求失败 (HTTP ' + res.status + ')');
  return json.data;
}

/** 追加消息气泡到聊天区 */
function addMsg(role, text) {
  welcomeEl.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'msg ' + role;
  var bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

/* ========== 回答美化：智能添加 emoji 前缀 ========== */

/**
 * 在 Markdown 文本层面做轻量美化：
 *   1. 为章节标题加上语境匹配的 emoji
 *   2. 确保模块之间有足够空行
 *   3. 不修改任何实质内容，只做格式与装饰
 */
function polishMarkdown(text) {
  // 给加粗序号标题加 emoji（匹配 "**1."、"**1、"、"**一、" 等中文/数字开头的标题行）
  text = text.replace(
    /^(\*{1,2}\s*(?:[0-9一二三四五六七八九十]+)[.、])\s*(.+?)\*{1,2}/gm,
    function (match, prefix, title) {
      var emoji = pickEmoji(title + match);
      return emoji + ' ' + match;
    }
  );

  // 给 Markdown 标题加 emoji（匹配 "# 1. xxx" 或 "## 一、xxx"）
  text = text.replace(
    /^(#{1,3}\s*(?:[0-9一二三四五六七八九十]+)[.、].+)$/gm,
    function (match) {
      var emoji = pickEmoji(match);
      return emoji + ' ' + match;
    }
  );

  // 确保模块标题前有空行分隔
  text = text.replace(/([^\n])\n(\*{1,2}\s*[0-9一二三四五六七八九十]+[.、])/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2');

  return text;
}

/** 根据标题内容关键词选择合适的 emoji */
function pickEmoji(text) {
  var t = text.toLowerCase();
  if (/养老|退休|养老金|保险|社保|保障|参保|职工/.test(t))     return '🏛️';
  if (/护理|医疗|健康|医院|长护|照护|失能|康复/.test(t))         return '🏥';
  if (/申请|办理|流程|条件|材料|步骤|资格|就业|登记/.test(t))    return '📋';
  if (/补贴|津贴|资金|费用|金额|标准|待遇|钱|工资/.test(t)) return '💰';
  if (/服务|社区|居家|助餐|助浴|上门|照料/.test(t))         return '🏠';
  if (/政策|法规|文件|通知|规定|条例/.test(t))         return '📜';
  if (/注意|提醒|风险|警告|重要/.test(t))             return '⚠️';
  if (/总结|归纳|综上|核心|要点|回顾/.test(t))         return '📌';
  if (/问题|问答|咨询|帮助|怎么|如何/.test(t))         return '💡';
  if (/评估|等级|鉴定|评级/.test(t))                   return '📊';
  if (/电话|热线|联系|地址/.test(t))              return '📞';
  if (/线上|APP|网站|公众号|小程序|电子|随申办|一网通办/.test(t))     return '📱';
  if (/老年|高龄|年龄|岁/.test(t))                     return '👴';
  return '📌';
}

/* ========== Markdown 渲染 + 安全净化 + 代码高亮 ========== */

/**
 * 完整的 AI 回答 → 安全 HTML 渲染管线：
 *   polishMarkdown() → marked.parse() → DOMPurify.sanitize() → hljs.highlightElement()
 */
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text; // 降级：插件未加载时原样显示

  try {
    // 1. Markdown 源文本美化（加 emoji + 空行分隔）
    var polished = polishMarkdown(text);

    // 2. Markdown → HTML
    var html = marked.parse(polished, { breaks: true, gfm: true });

    // 3. XSS 安全净化（DOMPurify，比手写正则更可靠）
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'h1','h2','h3','h4','h5','h6',
          'p','br','hr',
          'ul','ol','li',
          'strong','em','b','i','u','s','del',
          'a','img',
          'code','pre',
          'blockquote',
          'table','thead','tbody','tr','th','td',
          'span','div',
          'sub','sup','details','summary',
        ],
        ALLOWED_ATTR: ['href','src','alt','title','target','class','id','lang'],
      });
    }
    // 如果 DOMPurify 未加载，用轻量后备规则
    else {
      html = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<(img|svg|video|audio|object|embed|link|meta|form|input|button)[^>]*>/gi, '')
        .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
    }

    return html;
  } catch (e) {
    return text; // 渲染异常时降级为纯文本
  }
}

/**
 * 把 AI 回答写入气泡并触发代码高亮
 */
function setAnswer(bubble, answer) {
  bubble.classList.add('markdown');
  if (typeof answer === 'string' && !(answer.startsWith('{') || answer.startsWith('['))) {
    bubble.innerHTML = renderMarkdown(answer);

    // 表格 → 竖排列表（把多列表格转成每行一组键值对，避免横向溢出）
    convertTablesToList(bubble);

    // 代码块语法高亮（highlight.js）
    if (typeof hljs !== 'undefined') {
      var codes = bubble.querySelectorAll('pre code');
      for (var i = 0; i < codes.length; i++) {
        hljs.highlightElement(codes[i]);
      }
    }
  } else {
    bubble.textContent = answer;
  }
}

/**
 * 把 <table> 转成竖排列表：
 *   每个单元格变成独立一行，表头加粗 + 冒号前缀，数据紧随其后
 *   例：| A | B | C |
 *       | 1 | 2 | 3 |
 *   变成：
 *     A：1
 *     B：2
 *     C：3
 */
function convertTablesToList(container) {
  var tables = container.querySelectorAll('table');
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    var rows = table.querySelectorAll('tr');
    if (rows.length === 0) continue;

    // 提取表头（第一行 th 或第一行 td）
    var headers = [];
    var firstRow = rows[0];
    var headerCells = firstRow.querySelectorAll('th, td');
    for (var h = 0; h < headerCells.length; h++) {
      headers.push(headerCells[h].textContent.trim());
    }

    // 如果有表头行（含 th），数据从第二行开始；否则数据从第一行开始
    var hasHead = firstRow.querySelectorAll('th').length > 0;
    var dataStart = hasHead ? 1 : 0;

    // 构建竖排 HTML
    var out = '<div class="table-list">';
    for (var r = dataStart; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td, th');
      for (var c = 0; c < cells.length; c++) {
        var label = headers[c] || '';
        var value = cells[c].textContent.trim();
        out += '<div class="table-list-item">';
        if (label) {
          out += '<span class="table-list-key">' + label + '</span>：';
        }
        out += '<span class="table-list-val">' + value + '</span>';
        out += '</div>';
      }
    }
    out += '</div>';

    // 替换原 table
    var wrapper = document.createElement('div');
    wrapper.innerHTML = out;
    table.parentNode.replaceChild(wrapper, table);
  }
}

/* ========== 消息发送 ========== */

async function send() {
  var text = inputEl.value.trim();
  if (!text || sending) return;
  inputEl.value = '';

  addMsg('user', text);
  var typing = addMsg('assistant typing', '正在输入…');
  sending = true;
  btnSend.disabled = true;

  try {
    var data = await callApi('/api/chat', {
      query: text,
      conversation_id: conversationId,
      user: 'web-user-001',
    });
    var answer = data.answer;
    conversationId = data.conversation_id || '';
    convMetaEl.textContent = 'conversation_id: ' + (conversationId || '暂无');
    typing.className = 'msg assistant';
    setAnswer(typing, answer);
  } catch (err) {
    typing.className = 'msg error';
    typing.textContent = '❌ ' + err.message;
  } finally {
    sending = false;
    btnSend.disabled = false;
    inputEl.focus();
  }
}

/** 开启新对话 */
function newConversation() {
  conversationId = '';
  convMetaEl.textContent = 'conversation_id: 暂无（首条消息后生成，用于保持上下文）';
  var children = [].slice.call(chatEl.children);
  children.forEach(function (el) { if (el !== welcomeEl) el.remove(); });
  welcomeEl.style.display = '';
}
