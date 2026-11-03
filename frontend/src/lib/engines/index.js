// ============================================================
// AI图片工作台 - 引擎注册表 + 统一生成入口
// 生图函数统一签名：generate(task) → Promise<{images:[dataURL], meta}>
// task = { prompt(用户输入), refImages:[dataURL], refStrength, overrides:{...} }
// 核心生图逻辑移植自文生图工具2.0，去除 DOM 依赖，改为纯 Promise
// ============================================================
'use strict';

WB.engines = WB.engines || {};

WB.engines.registry = {};
WB.engines.register = function (id, engine) { WB.engines.registry[id] = engine; };

// 静默自动连接（对齐插件 autoConnectForMode）：启动/打开页面时重连并重扫模型列表。
// 不依赖 comfyConnected/sdConnected 标记拦截——每次调用都重新连接重扫，确保列表最新；
// 同一模式进行中不重复发起（并发防抖）；地址未配置或连接失败时静默返回 false。
const _autoConnectInFlight = {};
WB.engines.autoConnect = function (mode) {
  if (_autoConnectInFlight[mode]) return Promise.resolve(false);
  const s = WB.settings.all();
  const url = String((mode === 'comfyui' ? s.comfyUrl : s.sdUrl) || '').trim();
  const connKey = mode === 'comfyui' ? 'comfyConnected' : 'sdConnected';
  const markDisconnected = () => { if (WB.settings.get(connKey)) WB.settings.set(connKey, false); };
  if (!url) { markDisconnected(); return Promise.resolve(false); }
  const eng = WB.engines.registry[mode];
  if (!eng || !eng.connect) { markDisconnected(); return Promise.resolve(false); }
  _autoConnectInFlight[mode] = true;
  return eng.connect(true)
    .then(() => true)
    .catch(() => { markDisconnected(); return false; })
    .finally(() => { _autoConnectInFlight[mode] = false; });
};

// 统一入口
WB.engines.generate = async function (task) {
  const engineId = task.engine || 'comfyui';
  const engine = WB.engines.registry[engineId];
  if (!engine) throw new Error('未知引擎: ' + engineId);

  // 提示词组装（预设拼装 + 角色替换 + AQT 质量标签，移植插件 zhengmian/fumian）
  const prompt = WB.presets.manager.buildPositive(task.prompt || '');
  // 画布节点的显式负向提示词拼在全局预设负向之前；未传（task.negativePrompt 为空）时结果与原逻辑完全一致
  const negativePrompt = [task.negativePrompt, WB.presets.manager.buildNegative()]
    .filter(s => s && String(s).trim()).join(', ');
  const full = Object.assign({}, task, { prompt, negativePrompt });

  // 生成前缓存命中（对齐插件：按最终提示词匹配，有效期内直接返回历史图；画布/脚本调用可用 noCache 跳过）
  // 带蒙版的生成（inpaint）强制跳过缓存：缓存键只有提示词，不同蒙版会误命中上一次结果（规划方案 §5.6）
  const hasMask = Array.isArray(task.refMasks) && task.refMasks.some(m => m);
  if (WB.settings.get('cacheHit') !== false && !task.noCache && !hasMask) {
    const cached = await WB.history.findByPrompt(prompt);
    if (cached) {
      return { images: [cached], meta: { cached: true, engine: engineId } };
    }
  }

  const result = await engine.generate(full);
  if (!result || !result.images || !result.images.length) throw new Error('引擎未返回图片');
  // 携带最终提示词（含角色替换/预设拼装），供历史与灯箱展示"实际发送给引擎的提示词"
  result.meta = result.meta || {};
  result.meta.finalPrompt = prompt;
  result.meta.finalNegativePrompt = negativePrompt;
  return result;
};

// 提示词中 <lora:名:强度> 标签规范化（移植自插件 replaceLoraTags：补 .safetensors 后缀）
WB.engines.normalizeLoraTags = function (input) {
  return String(input || '').replace(/<lora:([^:]+)(?:\.safetensors)?:([^>]+)?>/g, (match, filename, value) => {
    return `<lora:${filename}.safetensors:${value}:1>`;
  });
};

// 模型文件名规范化：未含扩展名时补 .safetensors（移植自插件 modelFileNameWithExt）
WB.engines.modelFileNameWithExt = function (name) {
  const n = (name || '').trim();
  if (!n) return n;
  return /\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i.test(n) ? n : n + '.safetensors';
};
