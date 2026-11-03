// 最小事件总线：替代被移除的 vanilla WB.events（逻辑层 comfyui.js 等依赖 on/off/emit 与 _previewSubscribers）
window.WB = window.WB || {};
(function () {
  const map = {};
  const api = {
    _previewSubscribers: 0,
    on(evt, cb) {
      (map[evt] || (map[evt] = [])).push(cb);
      return () => api.off(evt, cb);
    },
    off(evt, cb) {
      if (map[evt]) map[evt] = map[evt].filter((f) => f !== cb);
    },
    emit(evt, payload) {
      (map[evt] || []).slice().forEach((cb) => {
        try { cb(payload); } catch (e) { console.error('[events]', evt, e); }
      });
    },
  };
  WB.events = api;
})();
