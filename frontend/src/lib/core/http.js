// ============================================================
// AI图片工作台 - 请求层：所有对外 HTTP 统一经服务端 /api/proxy 代理
// （移植自插件 GM_xmlhttpRequest 兼容层的请求封装思路，服务形态下由 Node 后台代发）
// ============================================================
'use strict';

WB.http = (function () {

  /**
   * 统一请求入口
   * @param {Object} cfg { url, method, headers, data(String|Object), timeout, responseType: 'text'|'binary' }
   * @returns Promise<{status, text?, base64?, contentType?, json?}>
   */
  function request(cfg) {
    const method = (cfg.method || 'GET').toUpperCase();
    let body = null;
    const headers = Object.assign({}, cfg.headers || {});
    if (cfg.data != null && method !== 'GET') {
      body = typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data);
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
    }
    return fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cfg.url, method, headers,
        body: method === 'GET' ? null : body,
        // 二进制/Multipart 请求：把原始字节 base64 后透传给代理（代理端 bodyBase64 解码后原样转发）
        bodyBase64: (method !== 'GET' && cfg.bodyBase64 != null) ? cfg.bodyBase64 : undefined,
        responseType: cfg.responseType || 'text'
      })
    }).then(r => r.json()).then(r => {
      if (r.error) throw new Error(r.error);
      const result = { status: r.status, contentType: r.contentType };
      if (r.binary) {
        result.base64 = r.base64;
      } else {
        result.text = r.text;
        try { result.json = JSON.parse(r.text); } catch (e) { /* 非 JSON */ }
      }
      if (r.status < 200 || r.status >= 400) {
        const err = new Error('请求失败，状态码: ' + r.status + (result.text ? '\n' + result.text.slice(0, 400) : ''));
        err.status = r.status;
        err.response = result;
        throw err;
      }
      return result;
    });
  }

  // JSON POST 快捷方式，直接返回解析后的 JSON
  async function requestJson(cfg) {
    const r = await request(cfg);
    if (!r.json) throw new Error('响应不是有效 JSON');
    return r.json;
  }

  return { request, requestJson };
})();
