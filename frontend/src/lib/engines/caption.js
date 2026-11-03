// ============================================================
// AI图片工作台 - 图片反推（Caption）引擎
// 全部经 ComfyUI 执行：前端内置反推工作流，按 /object_info 探测可用节点
// ★ 模型清单只放内存（probeCache），不写 settings —— ComfyUI 换模型后重开页面即反映
// ★ 新增反推节点只需在 TEMPLATES 里加一条声明，UI 与调用逻辑不用改
// ============================================================
'use strict';

WB.caption = (function () {
  const S = () => WB.settings.all();

  const MAX_SIDE = 1024;              // 上传前长边压缩（反推模型都会再缩放，传大图纯浪费）
  const POLL_MS = 500;
  const POLL_TIMEOUT_MS = 180000;     // 大权重首次加载慢，给足 3 分钟

  // 默认反推指令：语言由「模型 + 指令」自然决定，程序不做语言判断、不自动翻译
  const DEFAULT_PROMPT = '请用中文详细描述这张图片，输出可直接用于 AI 绘图的提示词：'
    + '依次包含主体、外貌服饰、动作姿态、场景环境、光线氛围、镜头与画风；'
    + '用短句或逗号分隔，不要解释、不要编号。';

  // 默认优化指令（提示词优化）：同样只由文本决定风格与语言
  const DEFAULT_REWRITE_PROMPT = '你是一名 AI 绘图提示词编辑。'
    + '请在保留原意与关键细节（主体、动作、服饰、场景、镜头、画风）的前提下，'
    + '把下面这段提示词改写得更具体、更有画面感，补足缺失的细节；'
    + '只输出改写后的提示词本身，不要解释、不要编号、不要加引号。';

  function fail(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  // ---------- object_info 取值工具 ----------
  // 取某节点某个 combo 输入的候选清单（如 CLIPLoader 的 clip_name / type）
  function comboOptions(info, classType, key) {
    const node = info && info[classType];
    const inp = (node && node.input) || {};
    const spec = (inp.required || {})[key] || (inp.optional || {})[key];
    if (!Array.isArray(spec)) return [];
    const list = spec[0];
    return Array.isArray(list) ? list.slice() : [];
  }

  // 节点的合法输入键集合（required + optional），用于提交前裁剪模板里多写的键
  function nodeKeys(info, classType) {
    const node = info && info[classType];
    const inp = (node && node.input) || {};
    const keys = Object.keys(inp.required || {}).concat(Object.keys(inp.optional || {}));
    return keys.length ? keys : null;
  }

  // 按节点 schema 裁剪工作流 inputs，避免不同版本参数增减导致校验失败
  function pruneBySchema(wf, schemas) {
    if (!schemas) return wf;
    for (const node of Object.values(wf)) {
      const keys = schemas[node.class_type];
      if (!Array.isArray(keys)) continue;
      for (const k of Object.keys(node.inputs)) {
        if (keys.indexOf(k) === -1) delete node.inputs[k];
      }
    }
    return wf;
  }

  // ---------- 输出取值 ----------
  function firstString(outputs, nodeId, key) {
    const out = outputs && outputs[nodeId];
    if (!out) return '';
    const arr = out[key];
    if (Array.isArray(arr) && arr.length && typeof arr[0] === 'string') return arr[0];
    return '';
  }

  // 兜底：遍历所有输出节点，取第一个非空字符串（适配未知的文本显示节点）
  function guessText(outputs) {
    const keys = ['text', 'tags', 'string', 'caption'];
    for (const nodeId of Object.keys(outputs || {})) {
      const out = outputs[nodeId] || {};
      for (const k of keys) {
        const arr = out[k];
        if (Array.isArray(arr) && arr.length && typeof arr[0] === 'string' && arr[0].trim()) return arr[0];
      }
    }
    return '';
  }

  // 结果清理：只做空白与逗号归一，不做去重、不翻译（避免破坏自然语言句子）
  function clean(text) {
    let t = String(text || '').replace(/\r/g, '');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n{3,}/g, '\n\n');
    t = t.replace(/\s*,\s*/g, ', ');
    t = t.replace(/(,\s*){2,}/g, ', ');
    t = t.replace(/^[\s,]+/, '').replace(/[\s,]+$/, '');
    return t.trim();
  }

  // ---------- 模板注册表 ----------
  // 每条模板自述：怎么探测 / 模型从哪来 / 有哪些附加参数 / 工作流长什么样 / 结果从哪取
  // promptKey 非空时把全局「反推指令」注入该字段；为 null 表示该模板不吃指令（UI 不做置灰）
  const TEMPLATES = [
    {
      id: 'textgen',
      label: '文本生成',
      need: ['CLIPLoader', 'TextGenerate', 'PreviewAny'],
      promptKey: 'prompt',
      models(info) {
        return comboOptions(info, 'CLIPLoader', 'clip_name').map(v => ({ value: v, label: v }));
      },
      fields(info) {
        return [{
          key: 'captionClipType', label: 'CLIP 类型', type: 'select', default: 'qwen_image',
          options: comboOptions(info, 'CLIPLoader', 'type')
        }];
      },
      build(ctx) {
        const wf = {
          '2': {
            class_type: 'CLIPLoader',
            inputs: { clip_name: ctx.model, type: ctx.clipType || 'qwen_image' }
          },
          '3': {
            class_type: 'TextGenerate',
            inputs: {
              clip: ['2', 0],
              prompt: ctx.prompt,
              max_length: 512,
              // ⚠ ComfyUI 的 DynamicCombo（COMFY_DYNAMICCOMBO_V3）只接受选项 key 字符串。
              //   传嵌套对象 {"sampling_mode":"off"} 会匹配不到选项被整条丢弃，
              //   表现为执行期 TextGenerate.execute() missing 'sampling_mode'。
              sampling_mode: 'off',
              use_default_template: true
            }
          },
          '4': { class_type: 'PreviewAny', inputs: { source: ['3', 0] } }
        };
        // 有图 → 补 LoadImage 并接到 image（图片反推）；无图 → 纯文本生成（提示词优化）。
        // TextGenerate 的 image 是可选输入，不接就是纯文本推理。
        if (ctx.file) {
          wf['1'] = { class_type: 'LoadImage', inputs: { image: ctx.file } };
          wf['3'].inputs.image = ['1', 0];
        }
        return pruneBySchema(wf, ctx.schemas);
      },
      extract(o) { return firstString(o, '4', 'text'); }
    }
  ];

  // ---------- 探测（结果只存内存） ----------
  let cache = null;      // { ok, code, message, templates:[{id,label,models,fields}], schemas }
  let inflight = null;

  function comfyUrl() {
    return String(S().comfyUrl || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
  }

  // 模板需要的节点类（新增模板自动纳入），只按需拉这几个节点的定义
  const NEEDED_NODES = Array.from(new Set(TEMPLATES.reduce((acc, t) => acc.concat(t.need), [])));

  // 按需拉取节点定义：不用 /object_info 全量（装了较多节点包时可达数十 MB，拖慢设置页）
  async function fetchNeededNodes() {
    // 探活用 /system_stats（极轻）；失败即「连不上」，与「连上了但没节点」区分开
    await WB.http.request({ method: 'GET', url: comfyUrl() + '/system_stats', timeout: 10000 });
    const info = {};
    await Promise.all(NEEDED_NODES.map(async (cls) => {
      try {
        const r = await WB.http.request({
          method: 'GET', url: comfyUrl() + '/object_info/' + encodeURIComponent(cls), timeout: 20000
        });
        if (r.json && r.json[cls]) info[cls] = r.json[cls];
      } catch (e) { /* 该节点未安装：忽略，由「未检测到反推节点」分支统一提示 */ }
    }));
    return info;
  }

  function probe(force) {
    // 成功结果整个会话复用；失败结果 30s 内复用（避免每次点击都重拉几 MB 的 object_info），
    // 过期后自动重试 —— 用户中途启动 ComfyUI 时不必手动刷新也能恢复
    if (!force && cache && (cache.ok || Date.now() - (cache.at || 0) < 30000)) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = (async () => {
      let info;
      try {
        info = await fetchNeededNodes();
      } catch (e) {
        return {
          ok: false, code: 'offline', templates: [], schemas: null, info: null,
          message: '无法连接 ComfyUI（' + comfyUrl() + '）—— 请确认 ComfyUI 已启动'
        };
      }

      const usable = [];
      let nodeButNoModel = null;
      for (const tpl of TEMPLATES) {
        if (!tpl.need.every(k => !!info[k])) continue;
        const models = tpl.models(info) || [];
        if (!models.length) {
          if (!nodeButNoModel) nodeButNoModel = tpl;
          continue;
        }
        usable.push({ id: tpl.id, label: tpl.label, models, fields: tpl.fields(info) || [] });
      }

      const schemas = {};
      for (const k of Object.keys(info)) {
        if (!TEMPLATES.some(t => t.need.indexOf(k) !== -1)) continue;
        const keys = nodeKeys(info, k);
        if (keys) schemas[k] = keys;
      }

      if (!usable.length) {
        if (nodeButNoModel) {
          return {
            ok: false, code: 'nomodel', templates: [], schemas, info: null,
            message: '已检测到「' + nodeButNoModel.label + '」节点，但模型列表为空'
              + '（往 ComfyUI 的 models/text_encoders 放入模型后点「刷新模型」）'
          };
        }
        return {
          ok: false, code: 'nonode', templates: [], schemas, info: null,
          message: '已连接 ComfyUI，但未检测到反推节点'
            + '（需要 ComfyUI 自带的 CLIPLoader + TextGenerate + PreviewAny）'
        };
      }
      return { ok: true, code: 'ok', templates: usable, schemas, message: '' };
    })().then(r => { r.at = Date.now(); cache = r; return r; })
      .finally(() => { inflight = null; });
    return inflight;
  }

  // ---------- 图片压缩 ----------
  async function shrink(dataUrl, maxSide) {
    try {
      const img = await WB.util.loadImageEl(dataUrl);
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!w || !h) return dataUrl;
      const longSide = Math.max(w, h);
      if (longSide <= maxSide) return dataUrl;
      const k = maxSide / longSide;
      const cw = Math.max(1, Math.round(w * k));
      const ch = Math.max(1, Math.round(h * k));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';      // 透明 PNG 转 JPEG 会变黑底，先铺白
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      return cv.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      return dataUrl;                 // 压缩失败不阻断，原图照传
    }
  }

  // ---------- 提交与轮询 ----------
  async function submitWorkflow(wf) {
    const r = await WB.http.request({
      method: 'POST', url: comfyUrl() + '/prompt',
      data: JSON.stringify({ client_id: 'wb-caption-' + Date.now(), prompt: wf }),
      timeout: 120000
    });
    const resp = r.json || {};
    const nodeErrs = resp.node_errors && Object.keys(resp.node_errors).length;
    if (resp.error || nodeErrs) {
      const detail = JSON.stringify(resp.error || resp.node_errors).slice(0, 200);
      throw fail('node', '反推失败：ComfyUI 拒绝执行 —— ' + detail);
    }
    if (!resp.prompt_id) throw fail('node', 'ComfyUI 未返回任务 ID');
    return resp.prompt_id;
  }

  // 从 ComfyUI 的 status.messages 里取真正的错误：
  // messages 是执行事件流水（execution_start / execution_cached / …），真正的报错在
  // execution_error 事件里；直接截取数组前若干字符只会拿到流水，看不到原因
  function describeExecError(status) {
    const msgs = (status && Array.isArray(status.messages)) ? status.messages : [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (!Array.isArray(m) || m[0] !== 'execution_error') continue;
      const d = m[1] || {};
      const where = [d.node_type, d.node_id ? '#' + d.node_id : ''].filter(Boolean).join(' ');
      const head = d.exception_type ? d.exception_type + '：' : '';
      const body = String(d.exception_message || '').trim() || 'ComfyUI 未提供错误信息';
      return (where ? '[' + where + '] ' : '') + head + body;
    }
    const last = msgs.length ? msgs[msgs.length - 1] : null;
    return last ? JSON.stringify(last).slice(0, 300) : '未知错误';
  }

  async function waitHistory(id) {
    const t0 = Date.now();
    while (Date.now() - t0 < POLL_TIMEOUT_MS) {
      await WB.util.sleep(POLL_MS);
      let hist;
      try {
        const r = await WB.http.request({ method: 'GET', url: comfyUrl() + '/history/' + id, timeout: 20000 });
        hist = r.json;
      } catch (e) { continue; }
      if (!hist || !hist[id]) continue;
      const entry = hist[id];
      if (entry.status && entry.status.status_str === 'error') {
        throw fail('node', '反推失败：' + describeExecError(entry.status));
      }
      const outputs = entry.outputs || {};
      if (Object.keys(outputs).length) return outputs;
    }
    throw fail('timeout', '反推超时（' + Math.round(POLL_TIMEOUT_MS / 1000) + 's）：模型可能仍在加载，或显存不足');
  }

  // ---------- 主入口 ----------
  async function run(dataUrl) {
    const st = S();
    if (String(st.captionEngine || 'comfyui') === 'off') {
      throw fail('off', '图片反推已关闭（基础设置 → 图片反推）');
    }

    const res = await probe(false);
    if (!res.ok) throw fail(res.code, res.message);

    // ★ 两层对象不要混用：
    //   res.templates = 探测结果（实时模型枚举 + 本次可用字段），没有函数
    //   TEMPLATES    = 静态定义（build / extract），按 id 对应
    // 保存的模板已不存在（例如旧版本选过后来被移除的模板）：忽略其模型，按「未选择」处理
    const saved = res.templates.some(t => t.id === st.captionTemplate) ? String(st.captionModel || '') : '';
    let picked = null;
    if (saved) {
      // 优先「模板 + 模型」精确命中；模型换了模板时跟随模型走
      picked = res.templates.find(t => t.id === st.captionTemplate && t.models.some(m => m.value === saved))
        || res.templates.find(t => t.models.some(m => m.value === saved));
      if (!picked) {
        // 选过的模型已不存在：不静默替换，明确让用户重选（状态可感知）
        throw fail('model-missing',
          '已选模型「' + saved + '」在 ComfyUI 中已找不到，请在基础设置 → 图片反推 里重新选择');
      }
    } else {
      picked = res.templates.find(t => t.id === st.captionTemplate) || res.templates[0];
    }

    const def = TEMPLATES.find(t => t.id === picked.id);
    if (!def || typeof def.build !== 'function') throw fail('internal', '反推模板定义缺失：' + picked.id);

    const model = saved || picked.models[0].value;
    if (st.captionTemplate !== picked.id || st.captionModel !== model) {
      WB.settings.set('captionTemplate', picked.id);
      WB.settings.set('captionModel', model);
    }

    const eng = WB.engines.registry.comfyui;
    if (!eng || typeof eng.uploadImage !== 'function') throw fail('internal', 'ComfyUI 引擎未就绪');

    const small = await shrink(dataUrl, MAX_SIDE);
    const file = await eng.uploadImage(small, 'wb_cap_');

    const prompt = String(st.captionPrompt || '').trim() || DEFAULT_PROMPT;

    // 模板附加参数兜底：无值、或值已不在候选里时，回落到模板声明的默认值
    for (const f of (picked.fields || [])) {
      const cur = S()[f.key];
      const valid = f.type === 'select' ? (f.options || []).indexOf(cur) !== -1 : (cur !== undefined && cur !== '');
      if (!valid && f.default !== undefined) WB.settings.set(f.key, f.default);
    }

    const wf = def.build({
      file, model, prompt,
      clipType: S().captionClipType,
      schemas: res.schemas,
      template: picked.id
    });

    const id = await submitWorkflow(wf);
    const outputs = await waitHistory(id);
    const raw = (def.extract && def.extract(outputs)) || guessText(outputs);
    if (!raw || !String(raw).trim()) {
      throw fail('empty', '反推完成，但没有取到文本（工作流未输出可读字符串）');
    }
    return clean(raw);
  }

  // ---------- 提示词优化（文 → 文） ----------
  // 与反推共用同一套 CLIPLoader + TextGenerate + PreviewAny，只是不接 image 输入
  async function rewrite(text) {
    const st = S();
    const src = String(text || '').trim();
    if (!src) throw fail('empty-input', '请先输入提示词');
    if (String(st.rewriteEngine || 'comfyui') === 'off') {
      throw fail('off', '提示词优化已关闭（基础设置 → 提示词优化）');
    }

    const res = await probe(false);
    if (!res.ok) throw fail(res.code, res.message);

    const picked = res.templates.find(t => t.id === 'textgen');
    if (!picked) throw fail('nonode', '未检测到可用的文本生成节点（需要 CLIPLoader + TextGenerate + PreviewAny）');
    const def = TEMPLATES.find(t => t.id === picked.id);
    if (!def) throw fail('internal', '反推模板定义缺失：' + picked.id);

    const saved = String(st.rewriteModel || '');
    let model = saved;
    if (!saved) {
      model = picked.models[0].value;
      WB.settings.set('rewriteModel', model);
    } else if (!picked.models.some(m => m.value === saved)) {
      throw fail('model-missing',
        '已选模型「' + saved + '」在 ComfyUI 中已找不到，请在基础设置 → 提示词优化 里重新选择');
    }

    const instruction = String(st.rewritePrompt || '').trim() || DEFAULT_REWRITE_PROMPT;
    const prompt = instruction + '\n\n原提示词：\n' + src;

    const wf = def.build({
      file: null,
      model,
      prompt,
      clipType: st.rewriteClipType || 'qwen_image',
      schemas: res.schemas,
      template: picked.id
    });

    const id = await submitWorkflow(wf);
    const outputs = await waitHistory(id);
    const raw = (def.extract && def.extract(outputs)) || guessText(outputs);
    if (!raw || !String(raw).trim()) {
      throw fail('empty', '优化完成，但没有取到文本（工作流未输出可读字符串）');
    }
    return clean(raw);
  }

  // 供设置页使用：当前探测结果（不触发请求）
  function snapshot() { return cache; }
  // 清缓存（切换 ComfyUI 地址后调用）
  function reset() { cache = null; }

  return { run, rewrite, probe, snapshot, reset, DEFAULT_PROMPT, DEFAULT_REWRITE_PROMPT, MAX_SIDE, TEMPLATES };
})();
