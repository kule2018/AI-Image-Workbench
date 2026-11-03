// ============================================================
// AI图片工作台 - 历史记录：落盘 history.json，条目含 engine 字段供各页过滤
// ============================================================
'use strict';

WB.history = (function () {

  const KEEP_DAYS = { '0': Infinity, '1': 1, '7': 7, '30': 30, '365': 365 };

  // 追加一条历史：图片自动落盘 output/，历史写 history.json
  async function add(entry) {
    // entry: { engine, prompt, negativePrompt, model, params, images:[dataURL|url] }
    const imageItems = [];
    const urls = [];
    for (const img of (entry.images || [])) {
      try {
        let url = img;
        if (img.startsWith('data:')) {
          const saved = await WB.api.saveImage(img);
          url = saved.url;
        }
        urls.push(url);
        const size = await WB.util.imageSize(img.startsWith('data:') ? img : url);
        imageItems.push({ url, width: size.w, height: size.h });
      } catch (e) {
        console.warn('历史图片落盘失败:', e);
      }
    }
    const item = {
      prompt: entry.prompt || '',
      finalPrompt: entry.finalPrompt || '',
      negativePrompt: entry.negativePrompt || '',
      images: urls,
      image_items: imageItems,
      timestamp: Date.now(),
      engine: entry.engine || '',
      model: entry.model || '',
      params: entry.params || {}
    };
    try { await WB.api.historyAppend(item); } catch (e) { console.warn('历史写入失败:', e); }
    return item;
  }

  async function list(engine, limit) {
    try { return await WB.api.historyList(engine, limit); } catch (e) { return []; }
  }

  async function remove(timestamps) { return WB.api.historyDelete(timestamps); }
  async function clear() { return WB.api.historyClear(); }

  // 清理过期历史（按 cacheDays 设置）
  async function cleanup() {
    const days = KEEP_DAYS[WB.settings.get('cacheDays')] ?? 30;
    if (days === Infinity) return;
    const cutoff = Date.now() - days * 86400000;
    try {
      const items = await WB.api.historyList('', 0);
      const expired = items.filter(i => (i.timestamp || 0) < cutoff).map(i => i.timestamp);
      if (expired.length) await WB.api.historyDelete(expired);
    } catch (e) { /* 忽略 */ }
  }

  // 生成前缓存命中检查（对齐插件：键=最终提示词，匹配历史提示词且在有效期内）
  async function findByPrompt(prompt) {
    if (!prompt) return null;
    const days = KEEP_DAYS[WB.settings.get('cacheDays')] ?? 30;
    const cutoff = days === Infinity ? 0 : Date.now() - days * 86400000;
    try {
      const items = await WB.api.historyList('', 0);
      for (const item of items) {
        if (item.prompt === prompt && (item.timestamp || 0) >= cutoff) {
          const first = item.image_items && item.image_items[0];
          if (first && first.url) return first.url;
        }
      }
    } catch (e) { /* 忽略 */ }
    return null;
  }

  return { add, list, remove, clear, cleanup, findByPrompt };
})();
