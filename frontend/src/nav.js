// 侧边导航配置（图标 SVG 字符串，原 WB.ui.icons 由本文件内联，避免依赖 vanilla ui 模块）
const I = {
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.2" fill="var(--panel)"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2.2" fill="var(--panel)"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="7" cy="17" r="2.2" fill="var(--panel)"/></svg>',
  workflow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v4M6 11v10M18 3v10M18 17v4M3 7h6M3 7l6 4M15 13h6M15 13l-6-2"/><circle cx="6" cy="9" r="2"/><circle cx="18" cy="15" r="2"/><circle cx="19.8" cy="19.8" r="2.5" stroke-width="1.5"/><path d="M19.8 17.2v-1.1M19.8 22.4v1.1M17.2 19.8h-1.1M22.4 19.8h1.1M17.96 17.96l-.78-.78M21.64 17.96l.78-.78M21.64 21.64l.78.78M17.96 21.64l-.78.78" stroke-width="1.5"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><circle cx="19.8" cy="19.8" r="2.5" stroke-width="1.5"/><path d="M19.8 17.2v-1.1M19.8 22.4v1.1M17.2 19.8h-1.1M22.4 19.8h1.1M17.96 17.96l-.78-.78M21.64 17.96l.78-.78M21.64 21.64l.78.78M17.96 21.64l-.78.78" stroke-width="1.5"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-.3A7 7 0 1 0 4 14.9"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/><circle cx="19.8" cy="19.8" r="2.5" stroke-width="1.5"/><path d="M19.8 17.2v-1.1M19.8 22.4v1.1M17.2 19.8h-1.1M22.4 19.8h1.1M17.96 17.96l-.78-.78M21.64 17.96l.78-.78M21.64 21.64l.78.78M17.96 21.64l-.78.78" stroke-width="1.5"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-.3A7 7 0 1 0 4 14.9"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v4M6 11v10M18 3v10M18 17v4M3 7h6M3 7l6 4M15 13h6M15 13l-6-2"/><circle cx="6" cy="9" r="2"/><circle cx="18" cy="15" r="2"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 5.5a3.2 3.2 0 0 1 0 5.9M19.5 20a6.4 6.4 0 0 0-2.2-4.4"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5" stroke-linecap="round"/></svg>',
};

export const navItems = [
  // 生图
  { id: 'comfyui', title: 'ComfyUI 生图', path: '/comfyui', group: 'top', icon: I.workflow },
  { id: 'sd', title: 'SD WebUI 生图', path: '/sd', group: 'top', icon: I.monitor },
  { id: 'api', title: '云端 API 生图', path: '/api', group: 'top', icon: I.cloud },
  { id: 'canvas', title: '无限画布', path: '/canvas', group: 'top', icon: I.grid },
  { id: 'assets', title: '素材库', path: '/assets', group: 'top', icon: I.folder },
  { id: 'characters', title: '角色列表', path: '/characters', group: 'top', icon: I.user },
  // 设置
  { id: 'basic-settings', title: '基础设置', path: '/basic-settings', group: 'bottom', icon: I.settings },
  { id: 'comfyui-settings', title: 'ComfyUI 设置', path: '/comfyui-settings', group: 'bottom', icon: I.workflow },
  { id: 'sd-settings', title: 'SD WebUI 设置', path: '/sd-settings', group: 'bottom', icon: I.monitor },
  { id: 'api-settings', title: 'API 设置', path: '/api-settings', group: 'bottom', icon: I.key },
  { id: 'about', title: '关于', path: '/about', group: 'bottom', icon: I.info },
];
