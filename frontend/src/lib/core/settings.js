// ============================================================
// AI图片工作台 - 设置层：defaultSettings（键名沿用插件）+ 落盘加载/保存
// ============================================================
'use strict';

WB.settings = (function () {

  // 内置尺寸预设（三页共用"预设尺寸"下拉，选择后回填宽度/高度）
  const SIZE_PRESETS = {
    '自定义': null,
    '1024×1024 (1:1)': [1024, 1024],
    '1216×832 (3:2 横)': [1216, 832],
    '832×1216 (2:3 竖)': [832, 1216],
    '1440×810 (16:9)': [1440, 810],
    '810×1440 (9:16)': [810, 1440],
    '1328×1328 (1:1 大)': [1328, 1328],
    '512×512': [512, 512],
    '768×512': [768, 512],
    '512×768': [512, 768]
  };

  const defaultSettings = {
    // ---- 通用 ----
    theme: 'light',
    cacheDays: '30',           // 历史保留天数：0 永久 / 1 / 7 / 30 / 365
    soundEnabled: true,
    batchConcurrency: '2',     // 预留
    autoDownload: false,
    cacheHit: false,           // 生成前缓存命中（默认关闭，对齐插件默认行为）
    compareOn: true,           // 图像对比：结果图悬停出现竖线，左＝原图（参考图第 1 张）/ 右＝新生成图（默认打开）
    samplePreview: false,      // 采样预览：生成时把 ComfyUI K 采样器实时预览同步到画布（默认关闭）
    AQT: '',                   // 正面质量附加标签（对齐插件）
    UCP: '',                   // 负面质量附加标签（对齐插件）

    // ---- 图片反推（模型清单不在此列：由 ComfyUI 的 /object_info 实时读取，只放内存） ----
    captionEngine: 'comfyui',  // comfyui | off
    captionTemplate: '',       // 选中模型所属的反推模板（如 textgen）
    captionModel: '',          // 选中的反推模型值
    captionClipType: 'qwen_image',   // 模板附加参数落点（textgen 的 CLIP 类型）
    captionPrompt: '请用中文详细描述这张图片，输出可直接用于 AI 绘图的提示词：依次包含主体、外貌服饰、动作姿态、场景环境、光线氛围、镜头与画风；用短句或逗号分隔，不要解释、不要编号。',
    captionWriteMode: 'append',      // 反推结果写入方式：append 追加（默认）/ replace 替换

    // ---- 提示词优化（与反推共用 ComfyUI 的文本生成节点，模型枚举同样实时读取） ----
    rewriteEngine: 'comfyui',  // comfyui | off
    rewriteTemplate: '',       // 选中模型所属模板（当前固定 textgen）
    rewriteModel: '',          // 选中的优化模型值
    rewriteClipType: 'qwen_image',   // CLIP 类型
    rewritePrompt: '你是一名 AI 绘图提示词编辑。请在保留原意与关键细节（主体、动作、服饰、场景、镜头、画风）的前提下，把下面这段提示词改写得更具体、更有画面感，补足缺失的细节；只输出改写后的提示词本身，不要解释、不要编号、不要加引号。',
    rewriteWriteMode: 'replace',     // 优化结果写入方式：replace 替换（默认）/ append 追加

    // ---- 提示词预设（对应插件 yushe：含效果图 referenceImage） ----
    yushe: { '默认': { fixedPrompt: '', negativePrompt: '', referenceImage: null } },
    yusheid: '默认',
    // ---- 风格预设（对应插件 stylePresets：含效果图 referenceImage） ----
    stylePresets: { '默认': { stylePrompt: '', referenceImage: null } },
    stylePresetId: '默认',
    // ---- 角色列表（对应插件 characterList：含 previewImage） ----
    characterList: [],
    characterListEnabled: true,

    // ---- 收藏（素材库图片/角色/预设） ----
    assetFavorites: [],        // 图片文件名列表
    characterFavorites: [],    // 角色 id 列表
    presetFavorites: [],       // 预设复合键列表（prompt:名称 / style:名称）

    // ---- 文本素材（素材库文本列表：{id,name,category,content} + 自定义分类） ----
    textAssets: [],
    textCategories: ['场景', '风格', '未分类'],
    textFavorites: [],         // 文本素材 id 列表

    // ---- SD WebUI ----
    sdUrl: 'http://localhost:7860',
    sdConnected: false,
    sdModel: '',
    sdModelList: [],
    sdSamplerList: [],
    sdLoraList: [],
    sdWidth: '1024', sdHeight: '1024',
    sdSteps: '20',
    sdCfgScale: '7',
    sdSeed: '-1',
    sdSamplerName: 'DPM++ 2M',
    sdScheduler: 'Karras',
    sdLora1: 'none', sdLora1ModelStrength: 1, sdLora1ClipStrength: 1,
    sdLora2: 'none', sdLora2ModelStrength: 1, sdLora2ClipStrength: 1,
    sdLora3: 'none', sdLora3ModelStrength: 1, sdLora3ClipStrength: 1,
    sdLora4: 'none', sdLora4ModelStrength: 1, sdLora4ClipStrength: 1,

    // ---- ComfyUI ----
    comfyUrl: 'http://127.0.0.1:8188',
    comfyConnected: false,
    comfyModelFormat: 'Checkpoint',   // Checkpoint / DDUF
    MODEL_NAME: '',                   // 当前模型（键名沿用插件）
    comfyCheckpointList: [],
    comfyUNETList: [],
    comfyTextEncoderList: [],
    comfyVAEList: [],
    comfyTextEncoder: '',
    comfyVAE: '',
    comfyClipType: '',
    comfyClipTypeOptions: [],
    comfyWidth: '1024', comfyHeight: '1024',
    comfySteps: '20',
    comfyCfgScale: '1',
    comfySeed: '0',
    comfyuisamplerName: 'euler_ancestral',
    comfyScheduler: 'simple',
    comfyLoraList: [],
    comfyLora1: 'none', comfyLora1ModelStrength: 1, comfyLora1ClipStrength: 1,
    comfyLora2: 'none', comfyLora2ModelStrength: 1, comfyLora2ClipStrength: 1,
    comfyLora3: 'none', comfyLora3ModelStrength: 1, comfyLora3ClipStrength: 1,
    comfyLora4: 'none', comfyLora4ModelStrength: 1, comfyLora4ClipStrength: 1,
    // 工作流预设 { 名称: { workflow: json字符串, snapshot: {...} } }
    workers: null,
    workerid: 'Checkpoint类型文生图模板',

    // ---- 云端 API（预设结构对齐插件：key/参数随预设保存，内置预设亦有独立覆盖数据） ----
    otherApiKey: '',                  // 全局兜底 Key（预设内无 key 时使用）
    otherApiModel: '',
    otherApiModels: [],               // 用户维护的模型列表（拉取勾选/手动添加/删除）
    otherApiPresets: null,            // { 名称: {url,key,model,imageSize,width,height,batchSize,steps,guidanceScale,cfg,seed,asyncMode,images,customBody} }
    otherApiPresetId: '硅基流动',
    otherApiWidth: '1024', otherApiHeight: '1024',
    otherApiSteps: '20',
    otherApiGuidanceScale: '7.5',
    otherApiSeed: '0',
    otherApiBatchSize: '1',
    otherApiImages: [],               // 氛围参考图（dataURL 数组，随 API 预设快照保存与切换，对齐原插件 otherApiImages）
    // 运行时镜像键（对齐插件：URL/请求体编辑即时持久化到运行时，预设对象只在「保存预设」时更新；
    // null = 尚未从预设同步过，引擎回退读取预设字段）
    otherApiUrl: null,
    otherApiCustomBody: null
  };

  const S = {};          // 运行时设置对象
  let readyPromise = null;
  const listeners = [];

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const saved = await WB.api.settingsGet();
      for (const [k, v] of Object.entries(defaultSettings)) {
        S[k] = (saved[k] !== undefined) ? saved[k] : v;
      }
      // 深合并预设对象，保证新增默认预设可见
      S.yushe = Object.assign({}, defaultSettings.yushe, saved.yushe || {});
      S.stylePresets = Object.assign({}, defaultSettings.stylePresets, saved.stylePresets || {});
      // 内置工作流预设兜底；builtin 预设的模板与快照始终取最新内置版
      //（模板/默认参数修复随版本下发；内置预设本身不可覆盖保存，故本地快照无保留意义）
      const builtin = WB.presets.builtinWorkers();
      S.workers = Object.assign({}, builtin, saved.workers || {});
      for (const [k, b] of Object.entries(builtin)) {
        if (S.workers[k] && S.workers[k].builtin) {
          S.workers[k].workflow = b.workflow;
          S.workers[k].note = b.note;
          S.workers[k].snapshot = Object.assign({}, b.snapshot);
        }
      }
      if (!S.workers[S.workerid]) S.workerid = Object.keys(S.workers)[0];
      // 内置云API预设兜底
      const builtinApi = WB.presets.builtinOtherApiPresets();
      S.otherApiPresets = Object.assign({}, builtinApi, saved.otherApiPresets || {});
      if (!S.otherApiPresets[S.otherApiPresetId]) S.otherApiPresetId = Object.keys(S.otherApiPresets)[0];
      applyBuiltinApiShell();
      ensurePerPresetModelPools();
      return S;
    })();
    return readyPromise;
  }

  // API 模型池按预设独立（preset.models，各预设各自拉取、互不共享）。
  // 旧数据只有全局 otherApiModels：迁移时当前活跃预设继承全局池，其余预设为空池；幂等可重复调用。
  function ensurePerPresetModelPools() {
    if (!S.otherApiPresets) return;
    for (const [id, p] of Object.entries(S.otherApiPresets)) {
      if (!p || typeof p !== 'object') continue;
      if (!Array.isArray(p.models)) {
        p.models = (id === S.otherApiPresetId) ? (S.otherApiModels || []).slice() : [];
      }
    }
  }

  function get(key) { return S[key]; }
  function all() { return S; }

  // 即时落盘单个/多个键（合并同一防抖窗口内的多次调用，避免先前的键被后来的调用冲掉）
  let saveTimer = null;
  let pendingPatch = {};
  function save(keys) {
    if (!keys) return;
    for (const k of (Array.isArray(keys) ? keys : [keys])) pendingPatch[k] = S[k];
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const patch = pendingPatch;
      pendingPatch = {};
      WB.api.settingsSave(patch);
    }, 300);
    listeners.forEach(fn => { try { fn(keys); } catch (e) { /* 忽略 */ } });
  }

  function set(key, value, persist) {
    S[key] = value;
    if (persist !== false) save(key);
  }

  // 插件格式全量 JSON 导入（键名一致性映射，兼容插件 GM 字符串值）
  async function importAll(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const payload = data.settings || data;   // 兼容 {settings:{...}} 或直接键值
    await applyImportedSettings(payload);
    return S;
  }

  // 备份包 settings 应用（兼容插件 GM 键值格式：对象类键为 JSON 字符串）
  async function applyImportedSettings(data) {
    const parse = (v) => {
      if (typeof v !== 'string') return v;
      try { const p = JSON.parse(v); return (p && typeof p === 'object') ? p : v; } catch (e) { return v; }
    };
    const out = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (k === 'workbenchFormat') continue;
      // 跳过插件内部键（内存变量/内置平台覆盖/模式标记）
      if (k.startsWith('_') || k.startsWith('__default__') || k === 'lastOtherApiPreset' || k === 'mode' || k === 'scriptEnabled' || k === 'quickSwitchEnabled') continue;
      out[k] = parse(v);
    }
    for (const k of Object.keys(defaultSettings)) {
      if (out[k] !== undefined) S[k] = out[k];
    }
    S.yushe = Object.assign({}, defaultSettings.yushe, out.yushe || {});
    S.stylePresets = Object.assign({}, defaultSettings.stylePresets, out.stylePresets || {});
    S.workers = Object.assign({}, WB.presets.builtinWorkers(), out.workers || {});
    for (const [k, b] of Object.entries(WB.presets.builtinWorkers())) {
      if (S.workers[k] && S.workers[k].builtin) {
        S.workers[k].workflow = b.workflow;
        S.workers[k].snapshot = Object.assign({}, b.snapshot);
      }
    }
    S.otherApiPresets = Object.assign({}, WB.presets.builtinOtherApiPresets(), out.otherApiPresets || {});
    if (!S.workers[S.workerid]) S.workerid = Object.keys(S.workers)[0];
    if (!S.otherApiPresets[S.otherApiPresetId]) S.otherApiPresetId = Object.keys(S.otherApiPresets)[0];
    applyBuiltinApiShell();
    ensurePerPresetModelPools();
    await WB.api.settingsSave(S);
    return S;
  }

  // 内置平台预设是锁定项，其 url/customBody/bodyFormat 始终以内置最新版为准（模板修复随版本下发）：
  // 地址输入框用「简单基址」便于拉取模型，生成时的全量接口地址放在请求体模板（customBody 的 url 字段）内。
  // 同时把当前内置平台的运行时镜像键同步为最新基址与请求体，迁移旧版本残留的全量 URL。
  function applyBuiltinApiShell() {
    const builtinApi = WB.presets.builtinOtherApiPresets();
    for (const [id, bp] of Object.entries(builtinApi)) {
      const sp = S.otherApiPresets && S.otherApiPresets[id];
      if (!sp || typeof sp !== 'object') continue;
      sp.url = bp.url;
      sp.customBody = bp.customBody;
      sp.bodyFormat = bp.bodyFormat;
      sp.hiddenFields = (bp.hiddenFields || []).slice();
    }
    if (builtinApi[S.otherApiPresetId]) {
      S.otherApiUrl = builtinApi[S.otherApiPresetId].url;
      S.otherApiCustomBody = builtinApi[S.otherApiPresetId].customBody || '';
    }
  }

  // 全量导出（兼容插件格式：直接键值 JSON）
  function exportAll() {
    const out = {};
    for (const k of Object.keys(defaultSettings)) out[k] = S[k];
    return JSON.stringify(out, null, 2);
  }

  function onChange(fn) { listeners.push(fn); }

  return { SIZE_PRESETS, defaultSettings, init, get, set, save, all, importAll, applyImportedSettings, exportAll, onChange };
})();
