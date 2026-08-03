// ===================== 配置区（部署前必改） =====================
// ⚠️ 直连版：无后端中转，浏览器直接调 Dify API
// 1. DIFY_BASE_URL：你的 Dify 公网地址（内网穿透后获得），必须以 /v1 结尾
//    例：https://xxxx.ngrok-free.app/v1 或 https://api.dify.ai/v1（云版）
const DIFY_BASE_URL = 'https://3b375e2a.r33.cpolar.top/v1';

// 2. DIFY_API_KEY：Dify「访问 API」页面的 API Secret（app- 开头）
//    ⚠️ 此密钥会暴露在公开代码中，仅供个人演示使用
const DIFY_API_KEY = 'app-fspfek2TonqCRqep5wMWkkZo';
// =================================================================

let conversationId = '';
let sending = false;

const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const btnSend = document.getElementById('btnSend');
const welcomeEl = document.getElementById('welcome');
const convMetaEl = document.getElementById('convMeta');

// 回车发送
inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

/* ================================================================
   渲染管线（与后端版一致）
   polishMarkdown(emoji) → marked → DOMPurify → hljs → 表格竖排
   ================================================================ */

/** 直接调用 Dify Chat API */
async function callDify(body) {
  var res = await fetch(DIFY_BASE_URL + '/chat-messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DIFY_API_KEY,
    },
    body: JSON.stringify(body),
  });
  var json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Dify 调用失败 (HTTP ' + res.status + ')');
  }
  return json;
}

/** 追加消息气泡 */
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

/** Markdown 源文本美化（emoji + 空行分隔） */
function polishMarkdown(text) {
  text = text.replace(
    /^(\*{1,2}\s*(?:[0-9一二三四五六七八九十]+)[.、])\s*(.+?)\*{1,2}/gm,
    function (match, prefix, title) {
      return pickEmoji(title + match) + ' ' + match;
    }
  );
  text = text.replace(
    /^(#{1,3}\s*(?:[0-9一二三四五六七八九十]+)[.、].+)$/gm,
    function (match) {
      return pickEmoji(match) + ' ' + match;
    }
  );
  text = text.replace(/([^\n])\n(\*{1,2}\s*[0-9一二三四五六七八九十]+[.、])/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2');
  return text;
}

/** Markdown → HTML + XSS 净化 + emoji 美化 */
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  try {
    var polished = polishMarkdown(text);
    var html = marked.parse(polished, { breaks: true, gfm: true });
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li',
          'strong','em','b','i','u','s','del','a','img','code','pre',
          'blockquote','table','thead','tbody','tr','th','td',
          'span','div','sub','sup','details','summary',
        ],
        ALLOWED_ATTR: ['href','src','alt','title','target','class','id','lang'],
      });
    } else {
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
    return text;
  }
}

/** 把 AI 回答写入气泡：渲染 + 表格竖排 + 代码高亮 */
function setAnswer(bubble, answer) {
  bubble.classList.add('markdown');
  if (typeof answer === 'string' && !(answer.startsWith('{') || answer.startsWith('['))) {
    bubble.innerHTML = renderMarkdown(answer);
    convertTablesToList(bubble);
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

/** 表格 → 竖排列表（表头: 数据 配对） */
function convertTablesToList(container) {
  var tables = container.querySelectorAll('table');
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    var rows = table.querySelectorAll('tr');
    if (rows.length === 0) continue;

    var headers = [];
    var firstRow = rows[0];
    var headerCells = firstRow.querySelectorAll('th, td');
    for (var h = 0; h < headerCells.length; h++) {
      headers.push(headerCells[h].textContent.trim());
    }

    var hasHead = firstRow.querySelectorAll('th').length > 0;
    var dataStart = hasHead ? 1 : 0;

    var out = '<div class="table-list">';
    for (var r = dataStart; r < rows.length; r++) {
      var cells = rows[r].querySelectorAll('td, th');
      for (var c = 0; c < cells.length; c++) {
        var label = headers[c] || '';
        var value = cells[c].textContent.trim();
        out += '<div class="table-list-item">';
        if (label) out += '<span class="table-list-key">' + label + '</span>：';
        out += '<span class="table-list-val">' + value + '</span></div>';
      }
    }
    out += '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = out;
    table.parentNode.replaceChild(wrapper, table);
  }
}

/** 发送消息 */
async function send() {
  var text = inputEl.value.trim();
  if (!text || sending) return;
  inputEl.value = '';

  addMsg('user', text);
  var typing = addMsg('assistant typing', '正在输入…');
  sending = true;
  btnSend.disabled = true;

  try {
    var data = await callDify({
      query: text,
      inputs: {},
      response_mode: 'blocking',
      conversation_id: conversationId,
      user: 'gh-pages-user',
    });

    var answer = data.answer || '';
    // 去掉模型思考过程 <think>...</think>
    answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

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
