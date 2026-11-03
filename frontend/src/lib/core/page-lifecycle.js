// ============================================================
// AI图片工作台 - 页面生命周期：统一「页面即将离开」的收尾时机
//
// 目的：让各模块能注册卸载回调，避免监听器残留与后台幽灵连接。
//
// 背景（踩过的坑）：采样预览用的是与 ComfyUI 共用的固定 clientId 常驻 WebSocket。
//   · 切页：单页应用内路由，不会触发 pagehide，只能靠路由显式调用页面的 destroy()；
//     app.js 的路由确实有 destroy() 调用，但控制台里一旦出现任何未捕获错误，
//     路由切换就会中断在渲染阶段 —— 此时「先 destroy 再 render」的顺序仍有保障，
//     真正的缺口在下面两种场景。
//   · 刷新 / 关闭标签页 / bfcache 进磁盘缓存：只会触发 pagefreeze / pagehide，
//     页面的 destroy() 不会被调用；旧连接滞留在 ComfyUI 侧，新页面用同一 clientId
//     连上时服务端会把旧连接顶掉（server.py 的 websocket_handler 里
//     self.sockets.pop(sid, None)），旧连接上正在推送的预览帧随即让 aiohttp 抛
//     ClientConnectionResetError → ComfyUI 控制台刷
//     "send error: Cannot write to closing transport"。
// 因此这里在 window 上挂 DOM 级监听，任何模块都能注册卸载回调。
//
// 加载方式：index.html 的 <script>，全局命名空间 WB（本项目为纯全局脚本、无模块）
// ============================================================
'use strict';

WB.pageLifecycle = (function () {

  const listeners = [];     // 页面卸载回调
  let fired = false;        // 已触发过卸载：避免重复执行

  // 注册「页面即将离开」回调。返回取消函数。
  function onPageUnload(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  // 主动触发所有卸载回调（幂等：已触发过则直接返回）。
  // 逆序执行 —— 后注册的先回收，与资源创建顺序相反。
  function runPageUnload() {
    if (fired) return;
    fired = true;
    for (let i = listeners.length - 1; i >= 0; i--) {
      try { listeners[i](); } catch (e) { /* 单个回调失败不影响其他 */ }
    }
    listeners.length = 0;
  }

  // pagefreeze（Chrome）：标签页进 bfcache / 被冻结时最早也最可靠的收尾时机。
  // 必须在此断开长连接：冻结后不再有 pagehide，若仍挂着 WebSocket，
  // 服务端会一直把我们当活跃连接（正是 "closing transport" 警告的温床）。
  window.addEventListener('pagefreeze', runPageUnload);

  // pagehide：刷新 / 关闭标签页 / 移动端切后台（现代浏览器用它替代已过时的 unload）
  window.addEventListener('pagehide', runPageUnload);

  // beforeunload：老浏览器 / 部分移动端兜底
  window.addEventListener('beforeunload', runPageUnload);

  // 用户从 bfcache 切回本页：复位卸载标记，允许各模块按需重新建立连接
  window.addEventListener('pageshow', (e) => { if (e && e.persisted) fired = false; });

  return { onPageUnload, runPageUnload };
})();
