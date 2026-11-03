// ============================================================
// AI 图片工作台 - 前端入口（Vue3 应用）
// 仅保留「逻辑层」：core / engines / presets 以副作用方式挂载到 window.WB；
// UI 全部由 Vue 组件实现（views/、components/），不再加载 vanilla ui/pages。
// 后端：NestJS + TypeORM + MySQL（默认 3000，dev 由 Vite 代理）。
// ============================================================
import { createApp } from 'vue';

// ---- 原版样式（全局，提供 .shell / .form-* / .toggle / .preset-* 等外观）----
import './assets/css/theme.css';
import './assets/css/shell.css';
import './assets/css/components.css';
import './assets/css/console.css';
import './assets/css/gallery.css';
import './assets/css/settings.css';
import './assets/css/canvas.css';
import './assets/css/picker.css';
import './assets/css/mask.css';

// ---- 逻辑层（顺序与原 index.html 一致，仅保留非 UI 部分）----
import './lib/core/page-lifecycle.js';
import './lib/core/utils.js';
import './lib/core/events.js';
import './lib/core/http.js';
import './lib/core/api.js';
import './lib/core/settings.js';
import './lib/core/history.js';
import './lib/presets/defaults.js';
import './lib/presets/manager.js';
import './lib/engines/index.js';
import './lib/engines/sd.js';
import './lib/engines/comfyui.js';
import './lib/engines/otherapi.js';
import './lib/engines/caption.js';

import App from './App.vue';
import router from './router';

async function boot() {
  // 等待设置加载完成（合并默认值与已存设置 + 内置工作流/API 预设兜底）
  await window.WB.settings.init();

  // 主题：根据设置切换 documentElement 的 class，并随设置变化同步
  const applyTheme = (dark) => document.documentElement.classList.toggle('theme-dark', !!dark);
  applyTheme(window.WB.settings.get('theme') === 'dark');
  window.WB.settings.onChange(() => applyTheme(window.WB.settings.get('theme') === 'dark'));

  // 历史清理（沿用原 boot 行为）
  try { await window.WB.history.cleanup(); } catch (e) { /* 忽略 */ }

  const app = createApp(App);
  app.use(router);
  app.mount('#app');
}

boot();
