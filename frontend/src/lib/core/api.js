// ============================================================
// AI图片工作台 - 服务端数据接口（落盘 data/*.json、output/、data/library/）
// ============================================================
'use strict';

WB.api = (function () {

  async function getJson(url, fallback) {
    try {
      const r = await fetch(url);
      if (!r.ok) return fallback;
      return await r.json();
    } catch (e) { return fallback; }
  }

  async function postJson(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return r.json();
  }

  // ---------- 设置 ----------
  const settingsGet = () => getJson('/api/settings', {});
  const settingsSave = (patch) => postJson('/api/settings', patch);

  // ---------- 历史 ----------
  async function historyList(engine, limit) {
    const q = engine ? ('?engine=' + encodeURIComponent(engine) + (limit ? '&limit=' + limit : '')) : '';
    const data = await getJson('/api/history' + q, { items: [] });
    return data.items || [];
  }
  const historyAppend = (item) => postJson('/api/history', { item });
  const historyDelete = (timestamps) => postJson('/api/history', { action: 'delete', timestamps });
  const historyClear = () => postJson('/api/history', { action: 'clear' });

  // ---------- 生成图落盘 ----------
  async function saveImage(dataUrl) {
    const r = await postJson('/api/history/save-image', { dataUrl });
    if (!r.url) throw new Error('图片落盘失败');
    return r;
  }

  // ---------- 画布 ----------
  const canvasList = () => getJson('/api/canvases', { items: [] }).then(d => d.items || []);
  const canvasSave = (canvas) => postJson('/api/canvases', canvas);
  const canvasGet = (id) => getJson('/api/canvases/' + encodeURIComponent(id), null);
  const canvasDelete = (id) => fetch('/api/canvases/' + encodeURIComponent(id), { method: 'DELETE' });

  // ---------- 素材库 ----------
  const libraryUpload = (dataUrl) => postJson('/api/library/upload', { dataUrl });

  // ---------- 文件管理 ----------
  async function storageFiles(dir, sub) {
    const data = await getJson('/api/storage-files?dir=' + dir + (sub ? '&sub=' + sub : ''), { items: [] });
    return data.items || [];
  }
  const storageDelete = (dir, names, sub) => postJson('/api/storage-files/delete', { dir, names, sub });

  // ---------- 全量导入导出（zip，对齐插件备份格式） ----------
  function exportAll() { window.location.href = '/api/export-all'; }
  // 导入：把 File 直接作为【二进制 body】上传。
  // ⚠ 绝不要用 FileReader.readAsDataURL + JSON 再传：
  //   备份包会随生成图增长到数百 MB，base64 要膨胀 4/3 倍（446MB → 约 595MB 字符串），
  //   两个后果都会让导入失败 ——
  //   ① 服务端 body 上限（普通接口 200MB）直接被拒；
  //   ② 超过 V8 单个字符串的最大长度（约 512MB）→ 浏览器侧抛 RangeError: Invalid string length。
  //   直接发 File（Blob）由浏览器流式发送，不经过 JS 字符串，内存与体积都是最优。
  async function importAllZip(file) {
    const r = await fetch('/api/import-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: file
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) {
      throw new Error('服务端返回异常（HTTP ' + r.status + '）：' + String(text || '').slice(0, 120));
    }
    if (!r.ok) throw new Error(data.error || ('导入失败（HTTP ' + r.status + '）'));
    return data;
  }

  // ---------- 应用信息 ----------
  const appInfo = () => getJson('/api/app-info', {});

  return {
    settingsGet, settingsSave,
    historyList, historyAppend, historyDelete, historyClear,
    saveImage,
    canvasList, canvasSave, canvasGet, canvasDelete,
    libraryUpload,
    storageFiles, storageDelete,
    exportAll, importAllZip,
    appInfo
  };
})();
