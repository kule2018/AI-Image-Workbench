// ============================================================
// AI图片工作台 - 预设管理：提示词/风格/工作流/云API预设 CRUD、快照切换、角色替换、提示词组装
// （预设结构与快照机制移植自文生图工具2.0，界面重新实现）
// ============================================================
'use strict';

WB.presets = WB.presets || {};

WB.presets.manager = (function () {
  const { toast, confirmBox } = WB.util;
  const S = () => WB.settings.all();

  // ---------- 工作流预设快照 ----------
  // 快照字段：ComfyUI 生图页可被"切换工作流"连带切换的参数（对齐插件 _getWorkerSnapshot 全量字段）
  const WORKER_SNAPSHOT_KEYS = [
    'comfyModelFormat', 'MODEL_NAME', 'comfyTextEncoder', 'comfyVAE', 'comfyClipType',
    'comfyWidth', 'comfyHeight', 'comfySteps', 'comfyCfgScale',
    'comfyuisamplerName', 'comfyScheduler', 'comfySeed',
    'comfyLora1', 'comfyLora1ModelStrength', 'comfyLora1ClipStrength',
    'comfyLora2', 'comfyLora2ModelStrength', 'comfyLora2ClipStrength',
    'comfyLora3', 'comfyLora3ModelStrength', 'comfyLora3ClipStrength',
    'comfyLora4', 'comfyLora4ModelStrength', 'comfyLora4ClipStrength'
  ];

  function captureWorkerSnapshot() {
    const snap = {};
    for (const k of WORKER_SNAPSHOT_KEYS) snap[k] = S()[k];
    return snap;
  }

  function applyWorkerSnapshot(snap) {
    if (!snap) return;
    for (const k of WORKER_SNAPSHOT_KEYS) {
      if (snap[k] !== undefined) WB.settings.set(k, snap[k], false);
    }
    WB.settings.save(WORKER_SNAPSHOT_KEYS);
  }

  // 内置工作流预设名（对齐插件：内置预设不可覆盖保存/删除）
  function isBuiltinWorker(id) {
    const w = S().workers?.[id];
    return !!(w && w.builtin);
  }

  // 从工作流 JSON 内容解析加载器，回填模型/格式/文本编码器/VAE
  // 对齐插件 _detectAndFillFromWorkflow：工作流里硬编码的模型名会被带出；
  // 使用 %MODEL_NAME% 等占位符的工作流（值为空）不会覆盖当前选择。
  function fillFromWorkflow(workflowText) {
    const engine = WB.engines && WB.engines.registry ? WB.engines.registry.comfyui : null;
    if (!engine || !engine.detectWorkflowLoaders) return;
    const info = engine.detectWorkflowLoaders(workflowText || '');
    const s = S();
    if (info.ckptName) {
      if (s.MODEL_NAME !== info.ckptName) WB.settings.set('MODEL_NAME', info.ckptName, false);
      if ((s.comfyModelFormat || 'Checkpoint') !== 'Checkpoint') WB.settings.set('comfyModelFormat', 'Checkpoint', false);
    } else if (info.unetName) {
      if (s.MODEL_NAME !== info.unetName) WB.settings.set('MODEL_NAME', info.unetName, false);
      if (s.comfyModelFormat !== 'DDUF') WB.settings.set('comfyModelFormat', 'DDUF', false);
    }
    if (info.clipName && s.comfyTextEncoder !== info.clipName) WB.settings.set('comfyTextEncoder', info.clipName, false);
    if (info.vaeName && s.comfyVAE !== info.vaeName) WB.settings.set('comfyVAE', info.vaeName, false);
    WB.settings.save(WORKER_SNAPSHOT_KEYS);
  }

  function workerWorkflowText(worker) {
    if (!worker) return '';
    return (typeof worker === 'object') ? (worker.workflow || '') : String(worker);
  }

  // 切换工作流预设：应用目标预设快照（对齐插件 worker_change → _normalizeWorker → _applyWorkerSnapshot → _detectAndFillFromWorkflow）
  // 注意：切换时不把当前参数写回旧预设——临时修改只对本次生图生效，仅「保存预设」落盘（对齐插件行为）
  //   1) 目标预设无快照时，缺失字段保持当前值（即仅切换工作流内容）
  //   2) 有快照（内置预设自带默认快照，用户预设经"保存参数"生成）则整体切换模型/格式/生成参数/LoRA
  //   3) 最后按工作流 JSON 中硬编码的加载器名称回填模型/文本编码器/VAE
  function switchWorker(newId) {
    const s = S();
    if (!s.workers[newId]) return;
    s.workerid = newId;
    const target = s.workers[newId];
    if (target.snapshot) applyWorkerSnapshot(normalizeSnapshot(target.snapshot));
    fillFromWorkflow(workerWorkflowText(target));
    WB.settings.save(['workerid', 'workers'].concat(WORKER_SNAPSHOT_KEYS));
  }

  // 快照归一化：确保全部快照键存在（缺失补当前值，对齐插件 _normalizeWorker）
  function normalizeSnapshot(snap) {
    const cur = captureWorkerSnapshot();
    const out = {};
    for (const k of WORKER_SNAPSHOT_KEYS) {
      out[k] = (snap[k] !== undefined && snap[k] !== null && snap[k] !== '') ? snap[k] : cur[k];
    }
    return out;
  }

  function saveWorkerSnapshot() {
    const s = S();
    if (!s.workers[s.workerid]) return;
    // 对齐插件 worker_save_handler：内置默认工作流不可覆盖保存，需"新建预设"
    if (s.workers[s.workerid].builtin) {
      toast('内置默认工作流不能覆盖保存，请使用「新建预设」以此工作流为基础创建新的工作流', 'error');
      return;
    }
    s.workers[s.workerid].snapshot = captureWorkerSnapshot();
    WB.settings.save('workers');
    toast('已保存当前参数到工作流预设「' + s.workerid + '」');
  }

  // ---------- 云API预设（对齐插件：key/参数随预设，切换预设连带切换） ----------
  // 切换预设时同步到全局运行时键（生图页参数区/引擎读取全局键）
  const API_RUNTIME_KEYS = ['otherApiKey', 'otherApiModel', 'otherApiUrl', 'otherApiCustomBody', 'otherApiWidth', 'otherApiHeight', 'otherApiSteps', 'otherApiGuidanceScale', 'otherApiBatchSize', 'otherApiSeed', 'otherApiImages'];

  function switchApiPreset(newId) {
    const s = S();
    if (!s.otherApiPresets[newId]) return;
    s.otherApiPresetId = newId;
    const p = s.otherApiPresets[newId];
    // 对齐插件 _applyOtherApiPresetToUI：无条件同步 key（预设无 key 时置空，杜绝残留上一平台 token）
    s.otherApiKey = p.key || '';
    s.otherApiModel = p.model || '';
    s.otherApiUrl = p.url || '';
    s.otherApiCustomBody = p.customBody || '';
    s.otherApiWidth = p.width || 1024;
    s.otherApiHeight = p.height || 1024;
    s.otherApiSteps = p.steps || 20;
    s.otherApiGuidanceScale = p.guidanceScale || 7.5;
    s.otherApiBatchSize = p.batchSize || 1;
    s.otherApiSeed = p.seed || 0;
    s.otherApiImages = Array.isArray(p.images) ? p.images : [];
    s.otherApiImageSize = p.imageSize || (s.otherApiWidth + 'x' + s.otherApiHeight);
    WB.settings.save(['otherApiPresetId', 'otherApiImageSize'].concat(API_RUNTIME_KEYS));
  }

  // 内置平台预设不可删除/不可覆盖请求体（对齐插件 __default__ 分支的锁定行为）
  function isBuiltinApiPreset(id) {
    return !!WB.presets.builtinOtherApiPresets()[id];
  }

  // 保存当前运行参数到指定预设（对齐插件 savePreset：收集全部预设字段）
  function saveApiPreset(name) {
    const s = S();
    const cur = s.otherApiPresets[name] || {};
    s.otherApiPresets[name] = Object.assign({}, cur, {
      url: s.otherApiUrl || cur.url || '',
      key: s.otherApiKey || cur.key || '',
      model: s.otherApiModel || cur.model || '',
      imageSize: (s.otherApiWidth || 1024) + 'x' + (s.otherApiHeight || 1024),
      width: s.otherApiWidth || 1024,
      height: s.otherApiHeight || 1024,
      batchSize: s.otherApiBatchSize || 1,
      steps: s.otherApiSteps || 20,
      guidanceScale: s.otherApiGuidanceScale || 7.5,
      cfg: cur.cfg || 4,
      seed: s.otherApiSeed || 0,
      asyncMode: cur.asyncMode || false,
      images: s.otherApiImages || cur.images || [],
      bodyFormat: cur.bodyFormat || 'flat',
      customBody: (s.otherApiCustomBody !== null && s.otherApiCustomBody !== undefined) ? s.otherApiCustomBody : (cur.customBody || '')
    });
    s.otherApiPresetId = name;
    WB.settings.save(['otherApiPresets', 'otherApiPresetId']);
    toast('预设「' + name + '」已保存');
  }

  function applyApiPreset(preset) {
    if (!preset) return null;
    return {
      key: preset.key || '',
      model: preset.model || '',
      width: preset.width || 1024,
      height: preset.height || 1024,
      steps: preset.steps || 20,
      guidanceScale: preset.guidanceScale || 7.5,
      seed: preset.seed || 0,
      batchSize: preset.batchSize || 1
    };
  }

  // ---------- 导入/导出（格式与文生图工具2.0 完全对齐，不重命名） ----------
  // 提示词预设：{name, positivePrompt, negativePrompt, referenceImage} 数组或单对象
  function importPromptPresets(parsed) {
    const s = S();
    if (!s.yushe) s.yushe = {};
    let last = null;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const p of list) {
      if (!p || !p.name) continue;
      s.yushe[p.name] = {
        fixedPrompt: p.positivePrompt || '',
        negativePrompt: p.negativePrompt || '',
        referenceImage: p.referenceImage || null
      };
      last = p.name;
    }
    if (last) s.yusheid = last;
    WB.settings.save(['yushe', 'yusheid']);
    return { last, count: list.filter(p => p && p.name).length };
  }

  function exportPromptPreset(id) {
    const s = S();
    const p = s.yushe[id] || {};
    return JSON.stringify({ name: id, positivePrompt: p.fixedPrompt || '', negativePrompt: p.negativePrompt || '', referenceImage: p.referenceImage || null }, null, 2);
  }
  function exportAllPromptPresets() {
    const s = S();
    return JSON.stringify(Object.entries(s.yushe || {}).map(([name, p]) => ({
      name, positivePrompt: p.fixedPrompt || '', negativePrompt: p.negativePrompt || '', referenceImage: p.referenceImage || null
    })), null, 2);
  }

  // 风格预设：{name, stylePrompt, referenceImage}
  function importStylePresets(parsed) {
    const s = S();
    if (!s.stylePresets) s.stylePresets = {};
    let last = null;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const p of list) {
      if (!p || !p.name) continue;
      s.stylePresets[p.name] = { stylePrompt: p.stylePrompt || '', referenceImage: p.referenceImage || null };
      last = p.name;
    }
    if (last) s.stylePresetId = last;
    WB.settings.save(['stylePresets', 'stylePresetId']);
    return { last, count: list.filter(p => p && p.name).length };
  }
  function exportStylePreset(id) {
    const s = S();
    const p = s.stylePresets[id] || {};
    return JSON.stringify({ name: id, stylePrompt: p.stylePrompt || '', referenceImage: p.referenceImage || null }, null, 2);
  }
  function exportAllStylePresets() {
    const s = S();
    return JSON.stringify(Object.entries(s.stylePresets || {}).map(([name, p]) => ({
      name, stylePrompt: p.stylePrompt || '', referenceImage: p.referenceImage || null
    })), null, 2);
  }

  // 角色列表：数组 [{id,name,keywords,prompt,enabled,previewImage}]
  // 增量导入：按 id 或名称匹配，命中则原位替换（保留原 id），未命中则追加，不删除原有角色
  function importCharacters(parsed) {
    const list = Array.isArray(parsed) ? parsed : (parsed.characterList || (parsed.name ? [parsed] : []));
    if (!list.length) return { count: 0, added: 0, replaced: 0 };
    const norm = (c, i) => ({
      id: c.id || ('c' + Date.now() + '_' + i),
      name: c.name || '未命名',
      keywords: c.keywords || [],
      prompt: c.prompt || '',
      enabled: c.enabled !== false,
      previewImage: c.previewImage || null
    });
    const s = S();
    const result = (s.characterList || []).slice();
    let added = 0, replaced = 0;
    list.forEach((raw, i) => {
      const c = norm(raw, i);
      const idx = result.findIndex(x => (c.id && x.id === c.id) || (c.name && x.name === c.name));
      if (idx >= 0) { result[idx] = { ...result[idx], ...c, id: result[idx].id }; replaced++; }
      else { result.push(c); added++; }
    });
    s.characterList = result;
    WB.settings.save('characterList');
    return { count: added + replaced, added, replaced };
  }
  function exportCharacters() {
    return JSON.stringify(S().characterList || [], null, 2);
  }

  // ---------- 工作流导入/导出：与插件双向兼容 ----------
  // 插件导出格式（worker_export_handler）：
  //   { name, workflow: { workflow: "<JSON字符串>", comfyModelFormat, MODEL_NAME, ... 其余快照字段平铺 } }
  // 旧格式：{ name, workflow: "<JSON字符串>" }
  // 纯工作流：直接是工作流 JSON（API 格式 {"1":{...}} 或 UI 格式 {nodes:[...]}）
  // 统一归一化为工作台结构 { workflow: "字符串", snapshot: {...} }
  function normalizeImportedWorker(raw) {
    let wf = '';
    let flat = null;
    if (typeof raw === 'string') {
      wf = raw;
    } else if (raw && typeof raw === 'object') {
      if (typeof raw.workflow === 'string') {
        wf = raw.workflow; flat = raw;
      } else if (raw.workflow && typeof raw.workflow === 'object') {
        // 三重嵌套兜底
        wf = (typeof raw.workflow.workflow === 'string') ? raw.workflow.workflow : JSON.stringify(raw.workflow);
        flat = raw.workflow;
      } else {
        // 纯工作流节点对象
        wf = JSON.stringify(raw);
      }
    }
    const snap = {};
    const src = flat || (raw && typeof raw === 'object' ? raw : null);
    if (src) {
      for (const k of WORKER_SNAPSHOT_KEYS) {
        if (k === 'workflow') continue;
        if (src[k] !== undefined && src[k] !== null && src[k] !== '') snap[k] = src[k];
      }
    }
    return { workflow: wf, snapshot: snap };
  }

  function importWorkers(parsed, fallbackName, rawText) {
    const s = S();
    if (!s.workers) s.workers = WB.presets.builtinWorkers();
    const items = [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.name && item.workflow !== undefined) items.push([item.name, item.workflow]);
      }
    } else if (parsed && parsed.name && parsed.workflow !== undefined) {
      items.push([parsed.name, parsed.workflow]);
    } else if (parsed && typeof parsed === 'object') {
      // 纯工作流 JSON 内容（无 name 字段）→ 用文件名命名（对齐插件）
      const name = fallbackName || '导入的工作流';
      items.push([name, (rawText && rawText.trim()) ? rawText : JSON.stringify(parsed)]);
    } else if (typeof parsed === 'string') {
      items.push([fallbackName || '导入的工作流', parsed]);
    }
    let last = null;
    for (const [name, raw] of items) {
      s.workers[name] = normalizeImportedWorker(raw);
      last = name;
    }
    if (last) {
      s.workerid = last;
      const w = s.workers[last];
      applyWorkerSnapshot(normalizeSnapshot(w.snapshot || {}));
      fillFromWorkflow(w.workflow || '');
    }
    WB.settings.save(['workers', 'workerid'].concat(WORKER_SNAPSHOT_KEYS));
    return { last, count: items.length };
  }

  // 导出为插件可直接导入的格式（快照字段平铺在 workflow 对象内）
  function exportWorker(id) {
    const w = S().workers[id] || {};
    const wfText = (typeof w === 'object') ? (w.workflow || '') : String(w);
    const snap = (w && w.snapshot) ? Object.assign(captureWorkerSnapshot(), w.snapshot) : captureWorkerSnapshot();
    const flat = { workflow: wfText };
    for (const k of WORKER_SNAPSHOT_KEYS) {
      if (k === 'workflow') continue;
      flat[k] = snap[k];
    }
    return JSON.stringify({ name: id, workflow: flat }, null, 2);
  }

  // ---------- 云API预设导入/导出：与插件双向兼容 ----------
  // 插件导出：{ _type: 'default'|'custom', name, [url], key, model, imageSize, width, height,
  //             batchSize, steps, guidanceScale, cfg, seed, images, customBody }
  // _type==='default'（或未提供 url 且命中内置平台名）表示"内置平台的覆盖数据"：
  //   只覆盖 key/model/生成参数/请求体，保留内置平台的 url 与固定请求体模板（插件 __default__ 分支语义）
  function numOr(v, d) {
    if (v === undefined || v === null || v === '') return d;
    const n = Number(v);
    return Number.isNaN(n) ? d : n;
  }

  // 从 customBody 推断请求体格式（插件不导出 bodyFormat 字段）
  // customBody 含 ${...} 占位符无法直接 JSON.parse，故用顶层 "body" 判定"完整配置模式"
  function inferBodyFormat(customBody) {
    const t = String(customBody || '').trim();
    if (!t) return 'flat';
    return /"body"\s*:\s*\{/.test(t) ? 'simple' : 'flat';
  }

  function importApiPresets(parsed) {
    const s = S();
    if (!s.otherApiPresets) s.otherApiPresets = WB.presets.builtinOtherApiPresets();
    const builtin = WB.presets.builtinOtherApiPresets();
    let last = null;
    let count = 0;
    const list = Array.isArray(parsed) ? parsed : [parsed];

    for (const p of list) {
      if (!p || !p.name) continue;
      count++;
      const isDefault = (p._type === 'default') || (!p.url && !!builtin[p.name]);

      if (isDefault && builtin[p.name]) {
        const base = builtin[p.name];
        const cur = s.otherApiPresets[p.name] || {};
        const w = numOr(p.width, cur.width || base.width || 1024);
        const h = numOr(p.height, cur.height || base.height || 1024);
        s.otherApiPresets[p.name] = Object.assign({}, base, cur, {
          key: (p.key !== undefined) ? p.key : (cur.key || ''),
          model: (p.model !== undefined) ? p.model : (cur.model || base.model || ''),
          imageSize: p.imageSize || cur.imageSize || (w + 'x' + h),
          width: w, height: h,
          batchSize: numOr(p.batchSize, cur.batchSize || base.batchSize || 1),
          steps: numOr(p.steps, cur.steps || base.steps || 20),
          guidanceScale: numOr(p.guidanceScale, cur.guidanceScale || base.guidanceScale || 7.5),
          cfg: numOr(p.cfg, (cur.cfg !== undefined ? cur.cfg : 4)),
          seed: numOr(p.seed, cur.seed || base.seed || 0),
          asyncMode: !!(p.asyncMode || cur.asyncMode),
          images: p.images || cur.images || [],
          // 未带 customBody 时保留内置平台固定请求体，避免被清空
          customBody: p.customBody || cur.customBody || base.customBody || ''
        });
      } else {
        const w = numOr(p.width, 1024);
        const h = numOr(p.height, 1024);
        const curCustom = s.otherApiPresets[p.name] || {};
        s.otherApiPresets[p.name] = {
          url: p.url || '',
          key: p.key || '',
          model: p.model || '',
          imageSize: p.imageSize || (w + 'x' + h),
          width: w, height: h,
          batchSize: numOr(p.batchSize, 1),
          steps: numOr(p.steps, 20),
          guidanceScale: numOr(p.guidanceScale, 7.5),
          cfg: numOr(p.cfg, 4),
          seed: numOr(p.seed, 0),
          asyncMode: !!p.asyncMode,
          images: p.images || [],
          // 模型池随预设独立：导入包未带 models 时沿用本地已有池（各预设互不共享）
          models: p.models || curCustom.models || [],
          // 与内置平台同名时优先沿用其 bodyFormat（如阿里云 dashscope 不能走 flat 的 URL 补全）
          bodyFormat: p.bodyFormat || (builtin[p.name] && builtin[p.name].bodyFormat) || inferBodyFormat(p.customBody),
          hiddenFields: p.hiddenFields || [],
          customBody: p.customBody || ''
        };
      }
      // 统一处理：确保模型池存在，并把导入预设自带模型放入模型池第一个
      // （内置与自定义预设都生效，避免刷新后模型选择框因无内置模型而消失）
      const preset = s.otherApiPresets[p.name];
      if (!Array.isArray(preset.models)) preset.models = [];
      if (preset.model && !preset.models.includes(preset.model)) preset.models.unshift(preset.model);
      last = p.name;
    }

    // 导入即落盘：switchApiPreset 只保存运行时键，需显式持久化 otherApiPresets，
    // 避免刷新页面时丢失刚导入的预设
    if (last) {
      switchApiPreset(last);
      WB.settings.save('otherApiPresets');
    } else {
      WB.settings.save('otherApiPresets');
    }
    return { last, count };
  }

  // 导出为插件可直接导入的格式
  function exportApiPreset(id) {
    const s = S();
    const p = s.otherApiPresets[id] || {};
    const isBuiltin = !!WB.presets.builtinOtherApiPresets()[id];
    const common = {
      name: id,
      key: p.key || '',
      model: p.model || '',
      imageSize: p.imageSize || (numOr(p.width, 1024) + 'x' + numOr(p.height, 1024)),
      width: numOr(p.width, 1024),
      height: numOr(p.height, 1024),
      batchSize: numOr(p.batchSize, 1),
      steps: numOr(p.steps, 20),
      guidanceScale: numOr(p.guidanceScale, 7.5),
      cfg: numOr(p.cfg, 4),
      seed: numOr(p.seed, 0),
      images: p.images || [],
      models: p.models || [],
      customBody: p.customBody || ''
    };
    const data = isBuiltin
      ? Object.assign({ _type: 'default' }, common)
      : Object.assign({ _type: 'custom', url: p.url || '' }, common);
    return JSON.stringify(data, null, 2);
  }

  // ---------- 提示词预设 ----------
  function promptPresetNames() { return Object.keys(S().yushe || {}); }

  function switchPromptPreset(id) {
    const s = S();
    if (!s.yushe[id]) return;
    s.yusheid = id;
    WB.settings.save('yusheid');
  }

  function savePromptPreset(id, fixedPrompt, negativePrompt, referenceImage) {
    const s = S();
    const cur = s.yushe[id] || {};
    s.yushe[id] = {
      fixedPrompt: fixedPrompt || '',
      negativePrompt: negativePrompt || '',
      referenceImage: (referenceImage !== undefined) ? referenceImage : (cur.referenceImage || null)
    };
    s.yusheid = id;
    WB.settings.save(['yushe', 'yusheid']);
    toast('提示词预设「' + id + '」已保存');
  }

  async function deletePromptPreset(id) {
    const s = S();
    if (Object.keys(s.yushe).length <= 1) { toast('至少保留一个预设', 'error'); return; }
    if (!await confirmBox('确定删除提示词预设「' + id + '」？')) return;
    delete s.yushe[id];
    if (s.yusheid === id) s.yusheid = Object.keys(s.yushe)[0];
    WB.settings.save(['yushe', 'yusheid']);
    toast('已删除');
  }

  // ---------- 风格预设 ----------
  function stylePresetNames() { return Object.keys(S().stylePresets || {}); }

  function switchStylePreset(id) {
    const s = S();
    if (!s.stylePresets[id]) return;
    s.stylePresetId = id;
    WB.settings.save('stylePresetId');
  }

  function saveStylePreset(id, stylePrompt, referenceImage) {
    const s = S();
    const cur = s.stylePresets[id] || {};
    s.stylePresets[id] = {
      stylePrompt: stylePrompt || '',
      referenceImage: (referenceImage !== undefined) ? referenceImage : (cur.referenceImage || null)
    };
    s.stylePresetId = id;
    WB.settings.save(['stylePresets', 'stylePresetId']);
    toast('风格预设「' + id + '」已保存');
  }

  async function deleteStylePreset(id) {
    const s = S();
    if (Object.keys(s.stylePresets).length <= 1) { toast('至少保留一个预设', 'error'); return; }
    if (!await confirmBox('确定删除风格预设「' + id + '」？')) return;
    delete s.stylePresets[id];
    if (s.stylePresetId === id) s.stylePresetId = Object.keys(s.stylePresets)[0];
    WB.settings.save(['stylePresets', 'stylePresetId']);
    toast('已删除');
  }

  // ---------- 角色关键词替换（移植自插件 replaceCharacterKeywords） ----------
  function replaceCharacterKeywords(prompt) {
    if (!S().characterListEnabled) return prompt;
    const list = S().characterList || [];
    if (!list.length) return prompt;
    let replacements = [];
    list.forEach(ch => {
      if (!ch.enabled || !ch.prompt || !ch.prompt.trim()) return;
      (ch.keywords || []).forEach(kw => {
        kw = (kw || '').trim();
        if (kw) replacements.push({ keyword: kw, prompt: ch.prompt.trim() });
      });
    });
    if (!replacements.length) return prompt;
    replacements.sort((a, b) => b.keyword.length - a.keyword.length);
    for (const rep of replacements) {
      const re = new RegExp(WB.util.escapeRegExp(rep.keyword), 'g');
      prompt = prompt.replace(re, rep.keyword + '(' + rep.prompt + ')');
    }
    return prompt;
  }

  // ---------- 提示词组装（移植自插件 zhengmian/fumian，含 AQT/UCP 质量标签） ----------
  // userPrompt: 生图页输入的提示词
  function buildPositive(userPrompt) {
    const s = S();
    let fixed = (s.yushe[s.yusheid] || {}).fixedPrompt || '';
    let style = (s.stylePresets[s.stylePresetId] || {}).stylePrompt || '';
    fixed = replaceCharacterKeywords(fixed);
    style = replaceCharacterKeywords(style);
    userPrompt = replaceCharacterKeywords(userPrompt || '');
    const parts = [];
    if (fixed.trim()) parts.push(fixed.trim());
    if (style.trim()) parts.push(style.trim());
    parts.push(userPrompt);
    const AQT = (s.AQT || '').trim();
    if (AQT) parts.push(AQT);
    return parts.filter(p => p !== '').join(', ');
  }

  function buildNegative() {
    const s = S();
    const text = replaceCharacterKeywords((s.yushe[s.yusheid] || {}).negativePrompt || '');
    const UCP = (s.UCP || '').trim();
    // 对齐插件 fumian：UCP 与预设负面用“, ”拼接，任一为空则取另一个
    if (!text) return UCP;
    if (!UCP) return text;
    return UCP + ', ' + text;
  }

  return {
    WORKER_SNAPSHOT_KEYS,
    captureWorkerSnapshot, applyWorkerSnapshot, switchWorker, saveWorkerSnapshot,
    isBuiltinWorker, fillFromWorkflow,
    switchApiPreset, saveApiPreset, applyApiPreset, isBuiltinApiPreset,
    importPromptPresets, exportPromptPreset, exportAllPromptPresets,
    importStylePresets, exportStylePreset, exportAllStylePresets,
    importCharacters, exportCharacters,
    importWorkers, exportWorker,
    importApiPresets, exportApiPreset,
    promptPresetNames, switchPromptPreset, savePromptPreset, deletePromptPreset,
    stylePresetNames, switchStylePreset, saveStylePreset, deleteStylePreset,
    replaceCharacterKeywords, buildPositive, buildNegative
  };
})();
