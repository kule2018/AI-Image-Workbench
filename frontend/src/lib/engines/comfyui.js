// ============================================================
// AI图片工作台 - ComfyUI 引擎（移植自文生图工具2.0 的 comfyui()/replacepro/processLoraNodes 等）
// 参考图机制：%image1% %image2%… 占位符注入 LoadImage 节点（上传后填文件名，v5 舍弃 IPAdapter）
// 多槽工作流：空槽由 pruneEmptyImageSlots 按拓扑通用裁剪（旁路节点重接/转换节点删除）
// ============================================================
'use strict';

(function () {
  const { toast, sleep, randomSeed } = WB.util;
  const S = () => WB.settings.all();
  const modelExt = WB.engines.modelFileNameWithExt;

  // Checkpoint 模型风格判定：SD/SDXL 系 → sdxl（EmptyLatentImage+CLIPSetLastLayer+karras）
  // 其余（Z-Image/Krea2 等单文件 AuraFlow 系）→ auraflow（移植自插件 isSdxlCheckpointModel 思路）
  const SDXL_KEYWORDS = /(sd15|sd1\.5|sd_xl|sdxl|juggernaut|dreamshaper|realvis|epicrealism|majicmix|counterfeit|anything|aom|xxmix|chillout|realistic)/i;
  function isSdxlCheckpointModel(name) {
    if (!name) return true;
    return SDXL_KEYWORDS.test(name);
  }

  // 从工作流 JSON 中根据 class_type 查找节点 ID（移植自插件 _getLoraNodeId）
  function getNodeByClass(json, classType) {
    try {
      const wf = parseWorkflow(cleanWorkflowJson(json));
      for (const [id, node] of Object.entries(wf)) {
        if (node.class_type === classType) return id;
      }
    } catch (e) { /* 降级正则 */ }
    const re = new RegExp(`"(\\d+)"\\s*:\\s*\\{[\\s\\S]*?"class_type":\\s*"${classType}"`);
    const m = json.match(re);
    return m ? m[1] : null;
  }

  // ============ 文本编码器加载器登记（接入第三方 CLIP 加载节点看这里） ============
  // 除官方 CLIPLoader 外，部分模型的专属编码器要走自定义节点加载
  // （如 Anima 的 Qwen3.5-4B 混合编码器 LoadQwen35AnimaCLIP，来自 comfyui-qwen35-anima）。
  // 在此登记 class_type → 编码器文件名字段，即可复用：LoRA 链的 clip 源查找、加载器检测、运行时覆盖。
  //   · fromSettings=true ：文件名由「设置页-文本编码器」覆盖（官方 CLIPLoader 的原有行为）
  //   · fromSettings=false：专属编码器，文件名写死在工作流内、不被覆盖
  //     （否则会被模型预设自动填回的通用编码器改成不兼容的值，例如 anima → qwen_3_06b_base）
  const CLIP_LOADER_TYPES = {
    'CLIPLoader': { nameKey: 'clip_name', fromSettings: true },
    'LoadQwen35AnimaCLIP': { nameKey: 'clip_name', fromSettings: false }
  };

  // 查找工作流中的 CLIP 加载器节点 ID（按登记顺序，官方节点优先）
  function getClipLoaderNodeId(json) {
    for (const ct of Object.keys(CLIP_LOADER_TYPES)) {
      const id = getNodeByClass(json, ct);
      if (id) return id;
    }
    return null;
  }

  // 清理运行占位符使工作流 JSON 可解析（移植自插件 _detectWorkflowLoaders 的清理逻辑）
  // %IPA_NODES%：工作台已移除 IPAdapter，旧插件导出的工作流残留该占位符，一律清除
  function cleanWorkflowJson(json) {
    const map = {
      '%LORA_NODES%': '', '%LORA_NODES_JSON2%': '', '%IPA_NODES%': '',
      '%LORA_MODEL_REF%': '"__ph__", 0', '%LORA_CLIP_REF%': '"__ph__", 0',
      '%LORA_MODEL_OUTPUT%': '"__ph__"', '%LORA_CLIP_OUTPUT%': '"__ph__"',
      '%LORA_MODEL_OUTPUT_JSON2%': '"__ph__"', '%LORA_CLIP_OUTPUT_JSON2%': '"__ph__"',
      '%KSAMPLER_MODEL_REF%': '"__ph__", 0', '%IPA_MODEL_SOURCE%': '"__ph__", 0',
      '%CLIP_SET_LAYER_NODE%': '', '%CLIP_REF%': '"__ph__", 0',
      '%LATENT_NODE%': '"class_type": "EmptyLatentImage",',
      // 模板中 %SCHEDULER% 位于引号内（"%SCHEDULER%"），此处只替换为裸词，避免产生 ""karras"" 非法 JSON
      '%SCHEDULER%': 'karras', '%AURAFLOW_NODE%': '', '%IMAGE_NODES%': '',
      // 分流占位符（工作流层面按“有无参考图”分叉）：此处仅为让检测解析通过
      '%has_ref%': 'false', '%ref_count%': '0'
    };
    let out = json;
    for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
    out = out
      .replace(/"%prompt%"/g, '""').replace(/"%negative_prompt%"/g, '""')
      .replace(/"%seed%"/g, '"0"').replace(/"%steps%"/g, '"1"').replace(/"%cfg_scale%"/g, '"1"')
      .replace(/"%sampler_name%"/g, '""').replace(/"%width%"/g, '"1"').replace(/"%height%"/g, '"1"')
      .replace(/"%denoise%"/g, '"1"')
      .replace(/"%MODEL_NAME%"/g, '""').replace(/"%CLIP_NAME%"/g, '""').replace(/"%VAE_NAME%"/g, '""')
      .replace(/"%CLIP_TYPE%"/g, '"sdxl"')
      .replace(/"%image\d+%"/g, '""');
    return out;
  }

  // === COMMENT-STRIP-START ===
  // 工作流 JSON 允许写注释：剔除 // 行注释、/* */ 块注释，并删除顶层注释字段。
  // 设置页粘贴的工作流在替换后会被整体 JSON.parse 提交给 ComfyUI，写注释会直接解析失败；
  // 这里统一清洗，扫描时跳过字符串字面量，避免误伤 "http://..." 这类内容。
  const NOTE_KEY_RE = /^_{1,2}(comment|note)s?_{0,2}$/i;

  function stripJsonComments(text) {
    const s = String(text ?? '');
    let out = '', inStr = false, quote = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (inStr) {
        out += c;
        if (c === '\\') { if (n !== undefined) out += n; i++; continue; }
        if (c === quote) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
      if (c === '/' && n === '/') {                 // 行注释：吃到行尾，保留换行符
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
        if (s[i] !== undefined) out += s[i];
        continue;
      }
      if (c === '/' && n === '*') {                 // 块注释：吃到 */
        i += 2;
        while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) {
          if (s[i] === '\n' || s[i] === '\r') out += s[i];
          i++;
        }
        i++; // 让外层 for 的 i++ 跳过结尾的 '/'
        continue;
      }
      out += c;
    }
    return out;
  }

  // 顶层注释字段不是节点 ID，提交给 ComfyUI 会被判为无效节点，解析后直接剔除
  function stripNoteKeys(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    for (const k of Object.keys(obj)) {
      if (NOTE_KEY_RE.test(k)) delete obj[k];
    }
    return obj;
  }

  // 工作流内容的统一解析入口：去注释 → 解析 → 去顶层注释字段
  function parseWorkflow(text) {
    return stripNoteKeys(JSON.parse(stripJsonComments(text)));
  }
  // === COMMENT-STRIP-END ===

  // 检测工作流中的模型加载器（移植自插件 _detectWorkflowLoaders）
  function detectWorkflowLoaders(workerJson) {
    const info = { hasUnet: false, hasCkpt: false, hasClip: false, hasVae: false, unetName: '', ckptName: '', clipName: '', vaeName: '' };
    if (!workerJson) return info;
    try {
      const wf = parseWorkflow(cleanWorkflowJson(workerJson));
      for (const node of Object.values(wf)) {
        if (!node || !node.class_type || !node.inputs) continue;
        const ct = node.class_type;
        if (ct === 'UNETLoader' && !info.hasUnet) { info.hasUnet = true; info.unetName = node.inputs.unet_name || ''; }
        else if (ct === 'CheckpointLoaderSimple' && !info.hasCkpt) { info.hasCkpt = true; info.ckptName = node.inputs.ckpt_name || ''; }
        else if (CLIP_LOADER_TYPES[ct] && !info.hasClip) { info.hasClip = true; info.clipName = node.inputs[CLIP_LOADER_TYPES[ct].nameKey] || ''; }
        else if (ct === 'VAELoader' && !info.hasVae) { info.hasVae = true; info.vaeName = node.inputs.vae_name || ''; }
      }
    } catch (e) { /* 解析失败返回空 */ }
    return info;
  }

  // 工作流类型与模型选择一致性校验（移植自插件 _ensureWorkflowModelMatch）
  function ensureWorkflowModelMatch() {
    const s = S();
    const info = detectWorkflowLoaders(getCurrentWorkflow());
    if (!info.hasUnet && !info.hasCkpt) return true;
    const expectDduf = info.hasUnet && !info.hasCkpt;
    const targetFmt = expectDduf ? 'DDUF' : 'Checkpoint';
    const list = expectDduf ? (s.comfyUNETList || []) : (s.comfyCheckpointList || []);
    const hardName = expectDduf ? info.unetName : info.ckptName;
    if ((s.comfyModelFormat || 'Checkpoint') !== targetFmt) {
      WB.settings.set('comfyModelFormat', targetFmt);
    }
    let model = (s.MODEL_NAME || '').trim();
    let modelOk = model !== '';
    if (modelOk && list.length && !list.includes(model)) modelOk = false;
    if (!modelOk) {
      if (hardName) {
        WB.settings.set('MODEL_NAME', hardName);
      } else if (!model) {
        throw new Error('请先选择 ' + (expectDduf ? 'DDUF(unet)' : 'Checkpoint') + ' 模型（点击连接获取列表）');
      }
      // model 非空但不在枚举：此处不再单独抛错（否则会抢先抛出、遗漏编码器/VAE 缺失项），
      // 统一交由 generate() 的聚合预检一次性列出所有缺失项
    }
    if (expectDduf) {
      if (!s.comfyTextEncoder && info.clipName) WB.settings.set('comfyTextEncoder', info.clipName);
      if (!s.comfyVAE && info.vaeName) WB.settings.set('comfyVAE', info.vaeName);
    }
    return true;
  }

  function getCurrentWorkflow() {
    const s = S();
    const w = s.workers[s.workerid];
    return (w && typeof w === 'object') ? (w.workflow || '') : (w || '');
  }

  // LoRA 节点链注入（移植自插件 processLoraNodes，仅保留 %LORA_MODEL_REF%/%LORA_CLIP_REF% 新格式）
  // lorasOverride：逐图 LoRA 覆盖（来自 task.loras，形如 [{name, model, clip}]）；为空则回退设置页 comfyLora1-4
  function processLoraNodes(json, lorasOverride) {
    const s = S();
    const enabled = [];
    if (Array.isArray(lorasOverride) && lorasOverride.length) {
      lorasOverride.forEach((l, i) => {
        if (l && l.name && l.name !== 'none' && l.name !== '') {
          enabled.push({ index: i + 1, name: l.name, modelStrength: Number(l.model ?? l.modelStrength) || 1, clipStrength: Number(l.clip ?? l.clipStrength) || 1 });
        }
      });
    } else {
      for (let i = 1; i <= 4; i++) {
        const name = s[`comfyLora${i}`];
        if (name && name !== 'none' && name !== '') {
          enabled.push({ index: i, name, modelStrength: s[`comfyLora${i}ModelStrength`] || 1, clipStrength: s[`comfyLora${i}ClipStrength`] || 1 });
        }
      }
    }
    const hasModelRef = json.includes('%LORA_MODEL_REF%');
    if (!enabled.length) {
      if (hasModelRef) {
        const srcModel = getNodeByClass(json, 'UNETLoader') || getNodeByClass(json, 'CheckpointLoaderSimple') || '20';
        const srcClip = getClipLoaderNodeId(json) || getNodeByClass(json, 'CheckpointLoaderSimple') || '20';
        const clipIdx = (srcModel === srcClip) ? '1' : '0';
        json = json.split('%LORA_MODEL_REF%').join(`"${srcModel}", 0`);
        json = json.split('%LORA_CLIP_REF%').join(`"${srcClip}", ${clipIdx}`);
        json = json.split('%LORA_NODES%').join('');
      } else {
        json = json.split('%LORA_NODES%').join('');
      }
      return json;
    }

    const baseId = 50;
    let nodesJson = '';
    function addLoraNode(lora, index, modelInput, clipInput) {
      const nodeId = baseId + index;
      const node = {
        inputs: { lora_name: modelExt(lora.name), strength_model: Number(lora.modelStrength), strength_clip: Number(lora.clipStrength), model: modelInput, clip: clipInput },
        class_type: 'LoraLoader',
        _meta: { title: `LoRA加载器 ${lora.index}` }
      };
      nodesJson += `,\n    "${nodeId}": ${JSON.stringify(node)}`;
      return String(nodeId);
    }

    if (hasModelRef) {
      const modelSource = getNodeByClass(json, 'UNETLoader') || getNodeByClass(json, 'CheckpointLoaderSimple') || '20';
      const clipSource = getClipLoaderNodeId(json) || getNodeByClass(json, 'CheckpointLoaderSimple') || '20';
      const firstClipIdx = (modelSource === clipSource) ? '1' : '0';
      enabled.forEach((lora, index) => {
        if (index === 0) addLoraNode(lora, index, [modelSource, 0], [clipSource, Number(firstClipIdx)]);
        else addLoraNode(lora, index, [String(baseId + index - 1), 0], [String(baseId + index - 1), 1]);
      });
      const last = String(baseId + enabled.length - 1);
      json = json.split('%LORA_MODEL_REF%').join(`"${last}", 0`);
      json = json.split('%LORA_CLIP_REF%').join(`"${last}", 1`);
      json = json.split('%LORA_NODES%').join(nodesJson);
    } else {
      json = json.split('%LORA_NODES%').join('');
    }
    return json;
  }

  // 运行时覆盖加载器节点模型（移植自插件 overrideLoaderModels）
  function overrideLoaderModels(json, payload) {
    try {
      const wf = parseWorkflow(json);
      const newModel = modelExt(payload.MODEL_NAME);
      const newClip = modelExt(payload.comfyTextEncoder);
      const newVae = modelExt(payload.comfyVAE);
      let changed = false;
      for (const node of Object.values(wf)) {
        if (!node || !node.class_type || !node.inputs) continue;
        const ct = node.class_type, inp = node.inputs;
        if (ct === 'UNETLoader' && newModel && inp.unet_name && inp.unet_name !== newModel) { inp.unet_name = newModel; changed = true; }
        else if (ct === 'CheckpointLoaderSimple' && newModel && inp.ckpt_name && inp.ckpt_name !== newModel) { inp.ckpt_name = newModel; changed = true; }
        // 只有 fromSettings 的加载器（官方 CLIPLoader）才被设置页编码器覆盖；
        // 专属编码器节点（如 LoadQwen35AnimaCLIP）保留工作流内写死的文件名
        const clipDef = CLIP_LOADER_TYPES[ct];
        if (clipDef && clipDef.fromSettings && newClip && inp[clipDef.nameKey] && inp[clipDef.nameKey] !== newClip) { inp[clipDef.nameKey] = newClip; changed = true; }
        if (ct === 'VAELoader' && newVae && inp.vae_name && inp.vae_name !== newVae) { inp.vae_name = newVae; changed = true; }
      }
      return JSON.stringify(wf);
    } catch (e) { return json; }
  }

  // base64 字符串 → Uint8Array（浏览器环境，无 Buffer 依赖）
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // Uint8Array → base64（分块避免 btoa 参数过长）
  function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // 参考图上传：dataURL → 经 ComfyUI /upload/image 落盘 → 返回 LoadImage 可用的文件名
  // （ComfyUI 的 LoadImage 只认 input 目录内的文件名，不能直接吃 base64，故必须走上传）
  async function uploadRefImage(dataUrl) {
    return uploadImageToComfy(dataUrl, 'wb_ref_');
  }

  // 蒙版上传（inpaint）：与参考图同一条链路，仅文件名前缀区分（wb_mask_）
  async function uploadMaskImage(dataUrl) {
    return uploadImageToComfy(dataUrl, 'wb_mask_');
  }

  // 通用：dataURL → multipart → ComfyUI /upload/image → 返回文件名（含子目录时拼 subfolder/name）
  async function uploadImageToComfy(dataUrl, prefix) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    if (!m) throw new Error('图片格式无效（需要 dataURL）');
    const mime = m[1] || 'image/png';
    const imgB64 = m[2];
    const ext = ({
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/webp': 'webp', 'image/gif': 'gif'
    })[mime] || 'png';
    const fname = prefix + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + ext;
    const BOUNDARY = '----WBFormBoundary' + Date.now().toString(16);
    const part = (name, val) =>
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${val}\r\n`;
    const header = part('overwrite', 'true') + part('subfolder', '') + part('type', 'input')
      + `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"; filename="${fname}"\r\nContent-Type: ${mime}\r\n\r\n`;
    const footer = `\r\n--${BOUNDARY}--\r\n`;
    // 组装完整 multipart 字节后再整体 base64（避免分段拼接时中间出现 '=' 填充导致解码截断）
    const enc = new TextEncoder();
    const headBytes = enc.encode(header);
    const imgBytes = base64ToBytes(imgB64);
    const footBytes = enc.encode(footer);
    const total = new Uint8Array(headBytes.length + imgBytes.length + footBytes.length);
    total.set(headBytes, 0);
    total.set(imgBytes, headBytes.length);
    total.set(footBytes, headBytes.length + imgBytes.length);
    const bodyBase64 = bytesToBase64(total);
    const comfyUrl = (S().comfyUrl || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
    const r = await WB.http.request({
      method: 'POST', url: comfyUrl + '/upload/image',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + BOUNDARY },
      bodyBase64, timeout: 60000
    });
    const info = r.json || {};
    const name = info.name;
    if (!name) throw new Error('图片上传失败：ComfyUI 未返回文件名（' + (r.text || '').slice(0, 200) + '）');
    const sub = info.subfolder;
    return (sub && sub !== '' && sub !== 'none') ? (sub + '/' + name) : name;
  }

  // === SLOT-PRUNE-START ===
  // 旁路型节点表：这类节点的"主输入"承载条件/数据主流，其余输入（如参考 latent）是可裁剪的旁路。
  // 裁剪空槽时，消费其输出的链接一律改接到主输入源（等价于图界面 bypass 语义）。
  // 新模型若有同类节点，在此加一行即可复用整套裁剪逻辑。
  // ============ 参考图接法登记（新增模型看这里） ============
  // 两类接法，各自一表：
  //   · 形态A｜旁路节点型  → 入 BYPASS_INPUT_MAP（节点类型 → 主输入名）
  //   · 形态B｜节点可选输入型 → 入 OPTIONAL_INPUT_MAP（节点类型 → {可选输入名集合}）
  // 接入新编辑模型时：先判定它属于哪一形态，再在对应表加一行即可复用整套裁剪，无需改算法。
  // 注意：动态节点的 class_type 是 UUID，直接以其 uuid 为键登记。
  // =========================================================
  const BYPASS_INPUT_MAP = {
    // ---- Flux 系列 / OmniGen2 系列（旁路合并节点：conditioning=主输入，latent=参考图） ----
    'ReferenceLatent': 'conditioning',
    // ---- inpaint 蒙版旁路（遮罩编辑器）：latent=主输入，mask=旁路。
    //      空蒙版槽裁剪时删除本节点并把消费者重接到 latent 源，工作流自然退化为普通编辑 ----
    'SetLatentNoiseMask': 'latent',
    // ---- 显存清理（非参考图，仅防误判） ----
    'easy cleanGpuUsed': 'anything',
    'RAMCleanup': 'anything'
  };

  // 通用可选输入表：某些编辑模型的参考图是"节点自身的多个可选输入"（而非独立旁路节点）。
  // 裁剪空槽时，闭包内节点将被删除，这里把这些"指向闭包节点"的可选输入字段一并断开，避免悬空。
  const OPTIONAL_INPUT_MAP = {
    // ---- Qwen-Image-Edit 系列（含 FireRed / Rapid-AIO · 多图编辑参考） ----
    'TextEncodeQwenImageEditPlus': { image1: 1, image2: 1, image3: 1 },
    // ---- Qwen-Image-2.1 系列（编辑+生图一体 · Autogrow 槽位 images.image_1~16，
    //      工作台内置模板用 1~8 槽，此处全量登记以便自建工作流复用 9~16 槽） ----
    'TextEncodeQwenImage21': {
      'images.image_1': 1, 'images.image_2': 1, 'images.image_3': 1, 'images.image_4': 1,
      'images.image_5': 1, 'images.image_6': 1, 'images.image_7': 1, 'images.image_8': 1,
      'images.image_9': 1, 'images.image_10': 1, 'images.image_11': 1, 'images.image_12': 1,
      'images.image_13': 1, 'images.image_14': 1, 'images.image_15': 1, 'images.image_16': 1
    },
    // ---- Krea2 系列（单图/双图编辑参考） ----
    'Krea2EditModelPatch': { source_latent_b: 1, source_image_b: 1, ref_boost_mask: 1 },
    'Krea2EditGroundedEncode': { image_b: 1 },
    // ---- LongCat-Image-Edit 系列（单图编辑 · 动态节点 UUID） ----
    '338a94d3-1c81-48c8-9edd-9907114ba7e7': { image: 1 },
    // ---- Mage-Flow-Edit 系列（多图参考 · 动态节点 UUID） ----
    'd069257b-0abc-4d5a-9a19-579e0fe5bd8d': { 'images.image_1': 1, 'images.image_2': 1, 'images.image_3': 1 },
    // ---- HiDream-E1 / E1.1 系列（pix2pix 条件重绘参考） ----
    'InstructPixToPixConditioning': { pixels: 1 }
  };

  // 通用空槽裁剪：对 image 为空的 LoadImage 槽位，
  //   1) 删除其下游"转换节点"链（VAEEncode 等：首个链接输入来自闭包内的节点）；
  //   2) 闭包内的旁路节点删除后，把消费其输出的链接重接到它的主输入源；
  //   3) 主干节点（KSampler 等：非旁路且首个链接输入来自闭包外）是裁剪边界，绝不触碰。
  function pruneEmptyImageSlots(json) {
    let wf;
    try { wf = parseWorkflow(json); } catch (e) { return json; }
    const emptySlots = Object.keys(wf).filter(id =>
      wf[id] && wf[id].class_type === 'LoadImage' && wf[id].inputs && wf[id].inputs.image === '');
    if (!emptySlots.length) return JSON.stringify(wf);

    // 消费者索引：srcId → [{ node, key, link }]
    const buildConsumers = () => {
      const m = {};
      for (const [id, n] of Object.entries(wf)) {
        if (!n || !n.inputs) continue;
        for (const [k, v] of Object.entries(n.inputs)) {
          if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && wf[v[0]]) {
            (m[v[0]] = m[v[0]] || []).push({ node: id, key: k, link: v });
          }
        }
      }
      return m;
    };

    for (const slotId of emptySlots) {
      if (!wf[slotId]) continue; // 可能已被上一槽清理连带删除
      // 受影响闭包：旁路节点可直接入内；非旁路节点仅当首个链接输入源于闭包内（转换节点）
      const affected = new Set([slotId]);
      const consumers = buildConsumers();
      const queue = (consumers[slotId] || []).map(c => c.node);
      while (queue.length) {
        const nid = queue.shift();
        if (affected.has(nid) || !wf[nid]) continue;
        const n = wf[nid];
        if (!BYPASS_INPUT_MAP.hasOwnProperty(n.class_type)) {
          const firstLink = Object.values(n.inputs || {})
            .find(v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && wf[v[0]]);
          if (!firstLink || !affected.has(firstLink[0])) continue; // 主干节点，裁剪边界
        }
        affected.add(nid);
        for (const c of (consumers[nid] || [])) queue.push(c.node);
      }

      // 断开可选输入：闭包内节点最终会被删除，把"其它节点指向它的可选输入"字段一并移除，
      // 否则这些可选输入会引用已删节点（悬空）。只作用于 OPTIONAL_INPUT_MAP 登记的可选输入。
      for (const nid of affected) {
        if (!wf[nid]) continue;
        for (const [cid, cn] of Object.entries(wf)) {
          if (!cn || !cn.inputs) continue;
          const opt = OPTIONAL_INPUT_MAP[cn.class_type];
          if (!opt) continue;
          for (const [k, v] of Object.entries(cn.inputs)) {
            if (Array.isArray(v) && v[0] === nid && opt[k]) delete cn.inputs[k];
          }
        }
      }

      // 重接旁路节点：所有指向它的输入改接其主输入源；主源仍在闭包内时等下一轮（链式旁路）
      const deleted = new Set();
      let changed = true;
      while (changed) {
        changed = false;
        for (const nid of affected) {
          if (deleted.has(nid) || !wf[nid]) continue;
          const n = wf[nid];
          const mainName = BYPASS_INPUT_MAP[n.class_type];
          if (!mainName) continue;
          const main = n.inputs && n.inputs[mainName];
          if (!Array.isArray(main) || main[0] === nid || !wf[main[0]] || deleted.has(main[0])) continue;
          for (const n2 of Object.values(wf)) {
            if (!n2 || !n2.inputs) continue;
            for (const [k, v] of Object.entries(n2.inputs)) {
              if (Array.isArray(v) && v[0] === nid) n2.inputs[k] = [main[0], main[1]];
            }
          }
          delete wf[nid];
          deleted.add(nid);
          changed = true;
        }
      }

      // 清理：闭包内已无任何消费者的节点（空 LoadImage、VAEEncode 等转换节点）
      let removed = true;
      while (removed) {
        removed = false;
        const used = new Set();
        for (const n of Object.values(wf)) {
          if (!n || !n.inputs) continue;
          for (const v of Object.values(n.inputs)) {
            if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string') used.add(v[0]);
          }
        }
        for (const nid of affected) {
          if (wf[nid] && !used.has(nid)) { delete wf[nid]; removed = true; }
        }
      }

      // 兜底：不允许悬空链接
      for (const [id, n] of Object.entries(wf)) {
        if (!n || !n.inputs) continue;
        for (const [k, v] of Object.entries(n.inputs)) {
          if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && !wf[v[0]]) {
            throw new Error('工作流裁剪后出现悬空链接：节点 ' + id + '.' + k + ' → ' + v[0]);
          }
        }
      }
    }
    return JSON.stringify(wf);
  }
  // === SLOT-PRUNE-END ===

  // 未导入参考图、但工作流把导入图当作必需输入（img2img 底图等）时的统一提示
  function img2imgNoRefError() {
    return new Error('当前工作流把导入的图片作为必需输入（如 img2img 的底图），未导入图片时无法生成；请先添加参考图，或改用初始 latent 为「空Latent」的工作流');
  }

  // 核心：工作流占位符替换（移植自插件 replacepro，去除 IPAdapter，新增 %image1%…/%denoise%）
  async function replacepro(payload, json) {
    // 先剥离注释：模板顶部/段落的说明注释里可能写有占位符名（如 %LORA_NODES%）。
    // 若不清除，后续 split 替换会命中注释里的字面量、把注入的节点文本塞进注释区，
    // 产生 "Unexpected non-whitespace character after JSON" 之类的提交解析错误。
    json = stripJsonComments(json);
    // 工作台已移除 IPAdapter：旧插件工作流残留的 %IPA_NODES% 占位符直接清除，否则 JSON 无法解析
    json = json.split('%IPA_NODES%').join('');
    json = json.split('"%seed%"').join(Number(payload.seed));
    json = json.split('"%steps%"').join(Number(payload.steps));
    json = json.split('"%cfg_scale%"').join(Number(payload.cfg_scale));
    json = json.split('"%sampler_name%"').join(JSON.stringify(payload.sampler_name));
    json = json.split('"%width%"').join(Number(payload.width));
    json = json.split('"%height%"').join(Number(payload.height));
    json = json.split('"%denoise%"').join(Number(payload.denoise));
    json = json.split('"%negative_prompt%"').join(JSON.stringify(payload.negative_prompt));
    json = json.split('"%prompt%"').join(JSON.stringify(payload.prompt));
    json = json.split('"%MODEL_NAME%"').join(JSON.stringify(modelExt(payload.MODEL_NAME)));
    json = json.split('"%CLIP_TYPE%"').join(JSON.stringify(payload.comfyClipType || 'lumina2'));
    if (payload.comfyTextEncoder) json = json.split('"%CLIP_NAME%"').join(JSON.stringify(modelExt(payload.comfyTextEncoder)));
    if (payload.comfyVAE) json = json.split('"%VAE_NAME%"').join(JSON.stringify(modelExt(payload.comfyVAE)));

    const isDduf = payload.comfyModelFormat === 'DDUF';
    const isAuraFlow = !isDduf && !isSdxlCheckpointModel(payload.MODEL_NAME);

    if (isAuraFlow) {
      json = json.split('%CLIP_SET_LAYER_NODE%').join('');
      json = json.split('%CLIP_REF%').join('%LORA_CLIP_REF%');
      json = json.split('%LATENT_NODE%').join('"class_type": "EmptySD3LatentImage",');
      json = json.split('%SCHEDULER%').join('simple');
      json = json.split('%AURAFLOW_NODE%').join(`,
    "33": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": { "title": "AuraFlow采样节点" }
    }`);
      json = json.split('%KSAMPLER_MODEL_REF%').join('"33", 0');
    } else {
      json = json.split('%CLIP_SET_LAYER_NODE%').join(`"2": {
      "inputs": {
        "stop_at_clip_layer": -2,
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPSetLastLayer",
      "_meta": { "title": "CLIP设置停止层" }
    },
    `);
      json = json.split('%CLIP_REF%').join('"2", 0');
      json = json.split('%LATENT_NODE%').join('"class_type": "EmptyLatentImage",');
      json = json.split('%SCHEDULER%').join(payload.scheduler || 'karras');
      json = json.split('%AURAFLOW_NODE%').join('');
      json = json.split('%KSAMPLER_MODEL_REF%').join(isDduf ? '"7", 0' : '%LORA_MODEL_REF%');
    }

    json = processLoraNodes(json, payload.loras);
    json = overrideLoaderModels(json, payload);

    // 参考图占位符：%image1% …（先上传到 ComfyUI 拿文件名，再注入 LoadImage 的 image 字段）
    // 必须放在 LoRA/加载器处理之后：此时全部占位符已落地，JSON 可直接解析做拓扑裁剪
    // 空槽置空后由 pruneEmptyImageSlots 通用裁剪：删除空槽的 LoadImage→转换节点链，
    // 并把旁路节点（如 ReferenceLatent）的条件链重接到上游，等价于图界面的 bypass 语义
    const refs = payload.refImages || [];

    // 参考图分流（工作流层面分叉，无需任何设置项）：
    // 工作流里写 "switch": %has_ref%  → 无参考图时替换为 false、有参考图时为 true；
    // %ref_count% → 替换为参考图张数（数字），供多态分支使用。
    // 配合 ComfySwitchNode（If/Else Switch，两侧输入 lazy）即可让同一份工作流在
    // “文生图 / 图生图”两种形态下走不同节点链，未被选中的分支不会被执行。
    json = json.split('%has_ref%').join(refs.length ? 'true' : 'false');
    json = json.split('%ref_count%').join(String(refs.length));

    if (/"%image\d+%"/.test(json)) {
      const names = [];
      for (const d of refs.slice(0, 9)) names.push(d ? await uploadRefImage(d) : '');
      for (let i = 1; i <= 9; i++) {
        const ph = `"%image${i}%"`;
        if (!json.includes(ph)) continue;
        json = json.split(ph).join(JSON.stringify(names[i - 1] || ''));
      }
      // 未导入参考图时槽位全部置空：空槽裁剪会删掉整条 LoadImage→转换节点→旁路链。
      // 只要工作流的初始 latent 不来自导入的图片（EmptyLatent/EmptyFlux2LatentImage 等），
      // 裁剪结果即等价于文生图，无需额外分支处理。
      try {
        json = pruneEmptyImageSlots(json);
      } catch (e) {
        if (!names.length && /悬空链接/.test(e.message)) throw img2imgNoRefError();
        throw e;
      }
      // img2img 类工作流的 KSampler.latent_image 来自底图 VAEEncode，导致该链路被 KSampler 反向引用、
      // 无法裁掉，裁剪后会残留 image 为空的 LoadImage —— 直接提交只会得到 ComfyUI 的节点报错，
      // 此处提前给出明确提示
      if (!names.length) {
        let leftover = false;
        try {
          leftover = Object.values(parseWorkflow(json)).some(n =>
            n && n.class_type === 'LoadImage' && !(n.inputs && n.inputs.image));
        } catch (e) { leftover = false; }
        if (leftover) throw img2imgNoRefError();
      }
    }

    // 蒙版占位符：%mask1% …（inpaint 遮罩；与参考图同一上传链路，文件名前缀 wb_mask_）
    //   %has_mask%   → 有蒙版 true / 无蒙版 false（裸词，供 ComfySwitchNode 分流）
    //   %mask_count% → 蒙版张数
    // 空蒙版槽位由 pruneEmptyImageSlots 整链裁掉：SetLatentNoiseMask 已登记为旁路型
    // （BYPASS_INPUT_MAP），裁剪时删除该节点并把消费链重接到 latent 编码源，
    // 工作流自然退化为普通编辑 —— 与「空蒙版＝整链裁掉」策略一致（规划方案 §5.4）。
    const maskRefs = payload.refMasks || [];
    const maskCount = maskRefs.filter(d => d).length;
    json = json.split('%has_mask%').join(maskCount ? 'true' : 'false');
    json = json.split('%mask_count%').join(String(maskCount));

    if (/"%mask\d+%"/.test(json)) {
      const maskNames = [];
      for (const d of maskRefs.slice(0, 9)) maskNames.push(d ? await uploadMaskImage(d) : '');
      for (let i = 1; i <= 9; i++) {
        const ph = `"%mask${i}%"`;
        if (!json.includes(ph)) continue;
        json = json.split(ph).join(JSON.stringify(maskNames[i - 1] || ''));
      }
      json = pruneEmptyImageSlots(json);
    }
    return json;
  }

  // ---------- 生成 ----------
  async function generate(task) {
    const comfyUrl = (S().comfyUrl || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
    if (!comfyUrl) throw new Error('请先在「ComfyUI 设置」中配置 API 地址');

    const ov = task.overrides || {};
    ensureWorkflowModelMatch();

    const s = S();
    const effFmt = s.comfyModelFormat || 'Checkpoint';
    // 画布文生图节点可覆盖模型（ov.model）；未传时行为与原来完全一致
    const effModel = (task.overrides && task.overrides.model) || s.MODEL_NAME || '';
    if (!effModel) throw new Error('请先连接 ComfyUI 并选择模型');

    let effTextEncoder = '', effVae = '';
    if (effFmt === 'DDUF') {
      effTextEncoder = s.comfyTextEncoder || '';
      effVae = s.comfyVAE || '';
      if (!effTextEncoder) throw new Error('DDUF 格式请先在「ComfyUI 设置」中选择文本编码器');
      if (!effVae) throw new Error('DDUF 格式请先在「ComfyUI 设置」中选择 VAE');
    }

    // 生成前预检：若曾连接成功枚举过（列表非空），当前所选模型/编码器/VAE 必须在该枚举内，
    // 缺失时一次性列出所有未检测到的项，替代"提交后 ComfyUI 节点报错"或"静默换成别的模型"
    const serverModelList = effFmt === 'DDUF' ? (s.comfyUNETList || []) : (s.comfyCheckpointList || []);
    const inList = (l, v) => !!v && l.length && l.some(x => String(x).toLowerCase() === String(v).toLowerCase());
    if (s.comfyConnected) {
      const missing = [];
      if (serverModelList.length && !inList(serverModelList, effModel)) missing.push('模型「' + effModel + '」');
      if (effFmt === 'DDUF') {
        if ((s.comfyTextEncoderList || []).length && !inList(s.comfyTextEncoderList, effTextEncoder)) missing.push('文本编码器「' + effTextEncoder + '」');
        if ((s.comfyVAEList || []).length && !inList(s.comfyVAEList, effVae)) missing.push('VAE「' + effVae + '」');
      }
      if (missing.length) {
        throw new Error('未检测到对应' + missing.join('、') + '，请在「ComfyUI 设置」中重新选择 ComfyUI 中存在的项');
      }
    }

    const refs = task.refImages || [];

    // ---- 通用蒙版包装（方式二）：裁剪 → 编辑 → 贴回 ----
    // 让"没有接入蒙版占位符"的编辑工作流也能局部编辑：
    //   条件：本次有蒙版（且画在第 1 张底图上）且当前工作流不含 %maskN%（含则走原生蒙版语义，不包装）
    //   做法：把底图按蒙版区域裁剪放大后作为输入图送模型；生成后把结果按羽化蒙版贴回原图
    let cropPack = null;
    const maskList = task.refMasks || [];
    if (maskList.some(m => m) && refs.length && !/"%mask\d+%"/.test(getCurrentWorkflow() || '')) {
      if (maskList[0]) {
        try {
          cropPack = await WB.util.cropForInpaint({
            baseUrl: refs[0],
            maskUrl: maskList[0],
            contextFactor: task.cropContextFactor,
            targetSize: task.cropTargetSize
          });
        } catch (e) {
          console.warn('[inpaint-crop] 裁剪失败，本次改用原图:', e);
          cropPack = null;
        }
      }
    }
    const refsForPayload = cropPack ? [cropPack.image].concat(refs.slice(1)) : refs;

    const seedVal = (() => {
      // 优先级：调用方覆盖（画布参数节点/脚本）> 设置页与生图页的种子框(comfySeed) > 随机
      // 生图页的种子输入框写入的是 settings.comfySeed，此处回退读取，否则该控件形同虚设（0/-1 仍随机）
      const v = parseInt(ov.seed ?? '');
      if (!isNaN(v) && v > 0) return v;
      const sv = parseInt(s.comfySeed ?? '');
      if (!isNaN(sv) && sv > 0) return sv;
      return randomSeed();
    })();

    const payload = {
      prompt: WB.engines.normalizeLoraTags(task.prompt || '').replaceAll('\n', ',').replaceAll('\\\\', '\\').replaceAll('\\', '\\\\'),
      negative_prompt: WB.engines.normalizeLoraTags(task.negativePrompt || '').replaceAll('\n', ',').replaceAll('\\\\', '\\').replaceAll('\\', '\\\\'),
      steps: Number(parseInt(ov.steps ?? s.comfySteps) || 20),
      sampler_name: ov.sampler ?? s.comfyuisamplerName ?? 'euler_ancestral',
      scheduler: ov.scheduler ?? s.comfyScheduler ?? 'karras',
      width: Number(parseInt(ov.width ?? s.comfyWidth) || 832),
      height: Number(parseInt(ov.height ?? s.comfyHeight) || 1216),
      cfg_scale: Number(parseFloat(ov.cfg ?? s.comfyCfgScale) || 1),
      seed: seedVal,
      denoise: Math.min(Math.max(parseFloat(task.refStrength ?? 0.75), 0.05), 0.99),
      MODEL_NAME: effModel,
      comfyModelFormat: effFmt,
      comfyClipType: s.comfyClipType || '',
      comfyTextEncoder: effTextEncoder,
      comfyVAE: effVae,
      refImages: refsForPayload,
      refMasks: task.refMasks || [],
      loras: task.loras || []
    };

    let wf = await replacepro(payload, getCurrentWorkflow());

    // 提交任务与预览 WebSocket 必须用同一个 client_id，才能收到该任务的采样预览帧。
    // 该 ID 为本页面实例唯一（见 PREVIEW_CLIENT_ID 定义处），故不会与其他标签页/其他人撞车。
    const body = JSON.stringify({ client_id: PREVIEW_CLIENT_ID, prompt: parseWorkflow(wf) });

    // 进入采样期：开始接收 K 采样器预览帧
    // ⚠ previewBusy 只用于「当前正在采样」的标记；是否收帧改由消息处理器判断订阅者数量，
    //   这样即使用户在采样中途才打开开关，也能立刻收到后续预览帧。
    previewBusy = true;
    if ((WB.events._previewSubscribers || 0) > 0) ensurePreviewSocket();

    try {
    const submit = await WB.http.request({
      method: 'POST', url: comfyUrl + '/prompt', data: body, timeout: 120000
    });
    const submitResp = JSON.parse(submit.text);
    if (submitResp.error || submitResp.node_errors && Object.keys(submitResp.node_errors).length) {
      const errMsg = submitResp.error ? JSON.stringify(submitResp.error) : JSON.stringify(submitResp.node_errors).slice(0, 500);
      throw new Error('ComfyUI 提交失败: ' + errMsg);
    }
    const id = submitResp.prompt_id;
    if (!id) throw new Error('ComfyUI 未返回任务 ID');

    // 轮询 /history/{id}（移植自插件轮询逻辑）
    for (let i = 0; i < 300; i++) {
      await sleep(1000);
      let hist;
      try {
        const r = await WB.http.request({ method: 'GET', url: comfyUrl + '/history/' + id, timeout: 20000 });
        hist = JSON.parse(r.text);
      } catch (e) { continue; }
      if (!hist.hasOwnProperty(id)) continue;
      const entry = hist[id];
      if (entry.status && (entry.status.status_str === 'error')) {
        const msg = entry.status.messages ? JSON.stringify(entry.status.messages).slice(0, 400) : '未知错误';
        throw new Error('ComfyUI 执行失败: ' + msg);
      }
      const outputs = entry.outputs || {};
      let imageInfo = null;
      for (const key of Object.keys(outputs)) {
        const out = outputs[key];
        const arr = out.images || out.gifs;
        if (Array.isArray(arr) && arr.length) {
          const d = arr[0];
          imageInfo = { filename: d.filename || '', subfolder: d.subfolder || '', type: d.type || 'output' };
          break;
        }
      }
      if (!imageInfo || !imageInfo.filename) {
        if (Object.keys(outputs).length === 0) continue; // 尚未完成
        throw new Error('ComfyUI 执行完成但未找到输出图片，请检查工作流的 SaveImage 节点');
      }
      let fileurl = `${comfyUrl}/view?filename=${encodeURIComponent(imageInfo.filename)}&type=${imageInfo.type}`;
      if (imageInfo.subfolder) fileurl += `&subfolder=${encodeURIComponent(imageInfo.subfolder)}`;
      const imgResp = await WB.http.request({ method: 'GET', url: fileurl, responseType: 'binary', timeout: 60000 });
      const dataUrl = 'data:image/png;base64,' + imgResp.base64;
      // 通用蒙版包装：把编辑结果按（羽化）蒙版贴回原图（最终输出＝原图尺寸）
      let outUrl = dataUrl;
      if (cropPack) {
        try { outUrl = await WB.util.stitchBack(dataUrl, cropPack); }
        catch (e) { console.warn('[inpaint-crop] 贴回失败，返回裁剪区域结果:', e); }
      }
      return { images: [outUrl], meta: { engine: 'comfyui', seed: seedVal, taskId: id, inpaintCrop: !!cropPack } };
    }
    throw new Error('等待 ComfyUI 生成超时（300秒），请检查 ComfyUI 是否正在运行');
    } finally {
      // 采样结束（无论成功/失败/超时）：停止接收预览帧，并通知界面收尾
      previewBusy = false;
      WB.events.emit('comfy-preview-end', {});
    }
  }

  // ---------- 连接：/object_info 扫描模型（移植自插件 testComfyuiHandler 扫描部分） ----------
  async function connect(silent) {
    const comfyUrl = (S().comfyUrl || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
    const r = await WB.http.request({ method: 'GET', url: comfyUrl + '/object_info', timeout: 20000 });
    const data = JSON.parse(r.text);
    const ckptList = (data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    const unetList = (data.UNETLoader?.input?.required?.unet_name?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    const clipList = (data.CLIPLoader?.input?.required?.clip_name?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    const vaeList = (data.VAELoader?.input?.required?.vae_name?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    const clipTypeOptions = (data.CLIPLoader?.input?.required?.type?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    const loraList = (data.LoraLoader?.input?.required?.lora_name?.[0] || []).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });

    const s = S();
    WB.settings.set('comfyCheckpointList', ckptList, false);
    WB.settings.set('comfyUNETList', unetList, false);
    WB.settings.set('comfyTextEncoderList', clipList, false);
    WB.settings.set('comfyVAEList', vaeList, false);
    WB.settings.set('comfyClipTypeOptions', clipTypeOptions, false);
    WB.settings.set('comfyLoraList', loraList, false);
    // 连接后不再对 CLIP类型/当前模型做"不在枚举则静默换第一个"的兜底，
    // 缺失由下拉框标注"未检测到对应模型"、生成前预检给出明确提示，避免静默替换误导
    const isDduf = (s.comfyModelFormat || 'Checkpoint') === 'DDUF';
    // 连接完成后：DDUF 且已选模型时按内置常量表自动填入 CLIP 类型/编码器/VAE（对齐插件）
    if (isDduf && s.MODEL_NAME) applyModelPreset(s.MODEL_NAME);
    WB.settings.set('comfyConnected', true, false);
    WB.settings.save(['comfyCheckpointList', 'comfyUNETList', 'comfyTextEncoderList', 'comfyVAEList', 'comfyClipTypeOptions', 'comfyLoraList', 'comfyClipType', 'MODEL_NAME', 'comfyConnected']);
    if (!silent) toast('ComfyUI 连接成功');
    return true;
  }

  // ===== 模型预设自动匹配（移植自插件 MODEL_PRESET_MAP / applyModelPreset）=====
  // 依据模型文件名关键词匹配 → 自动填入 CLIP 类型 / 文本编码器 / VAE（仅 DDUF 格式）
  // 命中后用户仍可在下拉框手动修改（编码器/VAE 自身变更不做自动推荐，避免覆盖手动设置）
  const MODEL_PRESET_MAP = [
    // Krea2 系列（单文件 checkpoint 版为 AuraFlow 架构）
    { keys: ['krea2', 'krea_2', 'redmix', 'krea'], type: 'krea2', clip: 'qwen3vl_4b_fp8_scaled.safetensors', vae: 'qwen_image_vae.safetensors', ckptStyle: 'auraflow' },
    // Z-Image 系列（默认 lumina2 + ae；单文件 checkpoint 版同样为 AuraFlow 架构）
    { keys: ['z_image', 'z-image', 'zimage', 'zit'], type: 'lumina2', clip: 'qwen_3_4b.safetensors', vae: 'ae.safetensors', ckptStyle: 'auraflow' },
    // Qwen-Image-2.1 系列（qwen_image_2.1_int8_convrot 等；编码器/VAE 均为 2.1 专属，
    // 必须放在下方通用 qwen-image 行之前，否则会被通用行的 2.5-VL 编码器/旧 VAE 抢先匹配）
    { keys: ['qwen_image_2.1', 'qwen_image_2_1', 'qwen-image-2.1', 'qwenimage2.1'], type: 'qwen_image', clip: 'qwen3vl_8b_int8_convrot.safetensors', vae: 'qwen_image_2.1_vae_bf16.safetensors' },
    // Qwen-Image 系列（qwen-image-2512 等）
    { keys: ['qwen-image', 'qwen_image', 'qwenimage'], type: 'qwen_image', clip: 'qwen_2.5_vl_7b_fp8_scaled.safetensors', vae: 'qwen_image_vae.safetensors' },
    // Anima 系列（虽工作流写 stable_diffusion，实际用 qwen_image）
    { keys: ['anima'], type: 'qwen_image', clip: 'qwen_3_06b_base.safetensors', vae: 'qwen_image_vae.safetensors' },
    // MOSS-Image 系列（moss_image_base / moss_image_sft 等；CLIP 类型 moss_image 为 ComfyUI 独立枚举，
    // 编码器为 Qwen3.5-9B，VAE 复用 flux2-vae）
    { keys: ['moss'], type: 'moss_image', clip: 'qwen3.5_9b_int8_convrot.safetensors', vae: 'flux2-vae.safetensors' },
    // FLUX.3 Image Klein 系列（flux3_image_klein_sd_int8_convrot 等；CLIP 类型是独立的 flux3，
    // 编码器 Qwen3-VL-4B，VAE 沿用 FLUX.2。必须放在下方 flux-2 行之前，
    // 否则会被 flux-2 的 'klein' 键抢先匹配成 flux2）
    { keys: ['flux3', 'flux-3', 'flux_3', 'flux3_image'], type: 'flux3', clip: 'qwen3vl_4b_int8_convrot.safetensors', vae: 'flux2-vae.safetensors' },
    // Flux-2 / Flux-2-klein 系列（flux-2-klein-9b-fp8、F2K-9b-* 等）
    { keys: ['flux-2', 'flux2', 'f2k', 'klein'], type: 'flux2', clip: 'qwen_3_8b_fp8mixed.safetensors', vae: 'flux2-vae.safetensors' },
    // Boogu 系列（VAE 为 flux1_vae_bf16）
    { keys: ['boogu', 'bogu'], type: 'qwen_image', clip: 'qwen3vl_8b_fp8_scaled.safetensors', vae: 'flux1_vae_bf16.safetensors' },
    // ERNIE 系列（ernie-image-turbo；flux2 type + ministral 编码器）
    { keys: ['ernie'], type: 'flux2', clip: 'ministral-3-3b.safetensors', vae: 'flux2-vae.safetensors' }
  ];

  // 按模型文件名匹配预设（大小写/后缀不敏感）
  function matchModelPreset(modelName) {
    const n = String(modelName || '').toLowerCase().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf)$/i, '');
    if (!n) return null;
    return MODEL_PRESET_MAP.find(p => p.keys.some(k => n.includes(k.toLowerCase()))) || null;
  }

  // 选择模型后自动填入 CLIP 类型 / 文本编码器 / VAE（仅 DDUF 格式；直接写运行时设置，UI 由调用方刷新）
  function applyModelPreset(modelName) {
    if ((S().comfyModelFormat || 'Checkpoint') !== 'DDUF') return false;
    const preset = matchModelPreset(modelName);
    if (!preset) return false;
    // CLIP 类型：直接取预设值，不再做"不在枚举则降级取第一个"的兜底，
    // 缺失由下拉框标注"未检测到对应模型"、生成前预检提示，避免静默顺位
    const s = S();
    if (preset.type && preset.type !== s.comfyClipType) WB.settings.set('comfyClipType', preset.type, false);
    if (preset.clip && preset.clip !== s.comfyTextEncoder) WB.settings.set('comfyTextEncoder', preset.clip, false);
    if (preset.vae && preset.vae !== s.comfyVAE) WB.settings.set('comfyVAE', preset.vae, false);
    WB.settings.save(['comfyClipType', 'comfyTextEncoder', 'comfyVAE']);
    return true;
  }

  // ---------- K 采样器实时预览（WebSocket） ----------
  // ComfyUI 会在 KSampler 采样过程中通过其 WebSocket 推送 `preview` 事件（binary 帧），
  // 帧格式（二进制，小端）：[4 字节 事件类型][4 字节 图像格式][图像数据]
  //   - 事件类型：1 = 预览图（PreviewImage / KSampler 进度预览）
  //   - 图像格式：1 = JPEG，2 = PNG
  // 必须用同一个 client_id 提交任务与订阅 WebSocket，才能收到该任务的预览帧。
  //
  // 协议要点：
  //   ① client_id 固定（本次会话唯一），提交 /prompt 时带上它；
  //   ② WebSocket 地址 = comfyUrl 的 host + /ws?clientId=<client_id>（http→ws / https→wss）；
  //   ③ 预览帧只在「采样进行中」到来，故连接可常驻，靠事件驱动显示；
  //   ④ 需要 ComfyUI 启动参数包含 `--preview-method auto|latent2rgb|taesd`
  //      （官方默认是 none，即不产生任何预览帧；此时开关打开也无画面，属预期行为，不会报错）。
  // 预览 clientId：**每个页面实例唯一**（不再用固定字符串）。
  //
  // ⚠ 为什么必须唯一（通用性关键，踩过的坑）：
  //   ComfyUI 的 websocket_handler 对「同一个 clientId 的新连接」会执行
  //   self.sockets.pop(sid, None) 把旧连接直接踢掉；若旧连接此刻正在推预览帧，
  //   服务端 aiohttp 就抛 ClientConnectionResetError → 控制台刷
  //   "send error: Cannot write to closing transport"。
  //   用固定 clientId 时，以下场景必然撞车（与使用者环境无关，人人都中）：
  //     · 同一浏览器开两个工作台标签页
  //     · 快速刷新：旧连接的 TCP 还没挥手完，新连接已带着同一 ID 上来
  //     · 多人/多窗口连同一台 ComfyUI
  //   收紧关闭时序只能降低概率、改不掉根因；让 ID 唯一才是根治，且不依赖
  //   任何 ComfyUI 版本的内部实现细节（通用性最好）。
  //
  // ⚠ 唯一性只需保证「同一时刻不重复」，不必跨会话稳定：
  //   预览帧是 ComfyUI 向所有已连接 socket 广播的，clientId 只用于把 /prompt
  //   的执行进度路由回提交者。因 /prompt 与 WS 在同一个页面实例内共用本变量，
  //   二者始终一致，预览与结果回收都不受影响。
  const PREVIEW_CLIENT_ID = 'wb-' + Date.now().toString(36) + '-'
    + Math.random().toString(36).slice(2, 10);
  let previewWs = null;          // 当前 WebSocket
  let previewWsUrl = '';         // 已连接的地址（切换 ComfyUI 地址时重连）
  let previewReady = false;      // WebSocket 是否已打开
  let previewBusy = false;       // 本次生成是否在采样中（用于过滤非本次的预览帧）
  let previewRetryTimer = null;  // 重连定时器
  let previewRetryCount = 0;     // 连续重连次数（成功打开后清零；用于退避与上限）
  let previewClosedByUs = false; // 本端主动关闭标记：onclose 里据此跳过重连（避免幽灵重连）
  let previewUnloaded = false;   // 页面正在卸载：一律不再发起连接

  // 预览连接只在「页面可见 + 确有订阅者 + 未在卸载」时才建立。
  // document.hidden 时连接没有意义（收帧也要被丢弃），且后台常连会加剧上述踢连接问题。
  function previewWanted() {
    if (previewUnloaded) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return (WB.events._previewSubscribers || 0) > 0;
  }

  // WebSocket 实际连接地址：
  // ⚠ 不能直连 ComfyUI 的 ws —— 页面在 localhost:8765，ComfyUI 在另一端口，浏览器会因同源策略
  //   /混合内容拦截。改连本后端的 /api/comfy-ws，由 server.js 做原生 TCP 双向转发（见 server.js upgrade）。
  function wsUrlFromHttp(httpUrl) {
    const target = String(httpUrl || '').trim().replace(/\/+$/, '')
      .replace(/^http:\/\//i, 'ws://')
      .replace(/^https:\/\//i, 'wss://') + '/ws?clientId=' + encodeURIComponent(PREVIEW_CLIENT_ID);
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/api/comfy-ws?target=' + encodeURIComponent(target);
  }

  // 二进制预览帧 → dataURL。返回 '' 表示不是可识别的预览帧。
  //
  // ⚠ 帧头是【大端序】（big-endian）——ComfyUI 官方客户端示例用 struct.unpack(">I", ...)，
  //   早期误用小端会导致 eventType 恒为乱值、imageType 判错 → 预览永远解析不出来。
  //
  // 二进制帧格式（server.py 的 send_bytes）：
  //   [4 字节 事件类型 (uint32 BE)][其余为负载]
  //   事件类型 1 = PREVIEW_IMAGE            → 负载 = [4 字节 图像格式][图像数据]（格式 1=JPEG 2=PNG）
  //   事件类型 4 = PREVIEW_IMAGE_WITH_METADATA → 负载 = [4 字节 元数据长度][元数据 JSON][图像数据]
  //                ⚠ 此类型【没有】独立的图像格式字段，图像数据紧跟在元数据之后；
  //                  格式需从元数据 JSON 中取，取不到时按 PNG 处理（ComfyUI 该路径实际输出 PNG）。
  function previewFrameToDataUrl(buf) {
    try {
      if (!(buf instanceof ArrayBuffer) || buf.byteLength <= 8) return '';
      const view = new DataView(buf);
      const evType = view.getUint32(0, false);   // 大端
      let mime = '', offset = 8;
      if (evType === 1) {
        const imgType = view.getUint32(4, false); // 大端：[tag 4][format 4][data]
        mime = imgType === 2 ? 'image/png' : (imgType === 1 ? 'image/jpeg' : '');
      } else if (evType === 4) {
        const metaLen = view.getUint32(4, false);
        offset = 8 + metaLen;                     // 跳过元数据 JSON，其后再无格式字段
        if (buf.byteLength <= offset) return '';
        mime = 'image/png';
        try {
          const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, metaLen)));
          if (meta && (meta.image_type === 1 || meta.image_type === 'jpeg')) mime = 'image/jpeg';
        } catch (e) { /* 元数据非 JSON：按 PNG 处理 */ }
      } else {
        return '';
      }
      if (!mime) return '';
      const payload = new Uint8Array(buf, offset);
      if (!payload.length) return '';
      let bin = '';
      const CHUNK = 0x8000;   // 分块避免超大参数把 apply 调用栈撑爆
      for (let i = 0; i < payload.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, payload.subarray(i, i + CHUNK));
      }
      return 'data:' + mime + ';base64,' + btoa(bin);
    } catch (e) { return ''; }
  }

  // 预览连接：按需建立，地址变化自动重连；失败退避重试（不打扰用户）
  function ensurePreviewSocket() {
    if (previewUnloaded) return null;
    if (!previewWanted()) return null;   // 无订阅者/页面不可见：不建连接
    const comfyUrl = (S().comfyUrl || 'http://127.0.0.1:8188').trim().replace(/\/+$/, '');
    if (!comfyUrl) return null;
    const want = wsUrlFromHttp(comfyUrl);
    if (previewWs && previewWsUrl === want &&
      (previewWs.readyState === 0 /* CONNECTING */ || previewWs.readyState === 1 /* OPEN */)) {
      return previewWs;
    }
    // 换地址前先把旧连接关干净（本端 ID 已唯一，这里是防御性收尾，避免任何悬空连接）
    closePreviewSocket();
    previewWsUrl = want;
    previewClosedByUs = false;
    let ws;
    try { ws = new WebSocket(want); } catch (e) { schedulePreviewRetry(); return null; }
    ws.binaryType = 'arraybuffer';   // 预览帧是二进制
    previewWs = ws;
    ws.onopen = () => {
      previewReady = true;
      previewRetryCount = 0;         // 连接成功：重连计数清零
      WB.events.emit('comfy-preview-status', { connected: true });
    };
    ws.onmessage = (ev) => {
      // 只关心本次采样期间到达的预览帧；采样结束后（previewBusy=false）到达的丢弃。
      // 是否收帧再看订阅者数量——中途打开开关也能立即生效。
      if (!previewBusy || !(WB.events._previewSubscribers > 0)) return;
      const url = previewFrameToDataUrl(ev.data);
      if (url) WB.events.emit('comfy-preview', { dataUrl: url });
    };
    ws.onerror = () => { /* 由 onclose 统一处理重连 */ };
    ws.onclose = (ev) => {
      previewReady = false;
      if (previewWs === ws) { previewWs = null; }
      WB.events.emit('comfy-preview-status', { connected: false });
      // 本端主动关闭（换地址/退订/卸载）不重连
      if (previewClosedByUs || previewUnloaded) return;
      // 1000=正常关闭 / 1001=端点离开（服务端踢同 clientId 连接时常用此码）。
      // 这类关闭重连无益，只记一条 info 供排查（ID 已唯一，正常不会出现）
      if (ev && (ev.code === 1000 || ev.code === 1001)) {
        if (window.console && console.info) {
          console.info('[comfyui] 预览连接被关闭（code=' + ev.code + '），不再重连');
        }
        return;
      }
      schedulePreviewRetry();
    };
    return ws;
  }

  // 退避重连：1s → 2s → 4s → 8s，最多 5 次；任一次连接成功即清零。
  // ⚠ 不能固定 3 秒盲目重连：ComfyUI 没启动时，每 3 秒一轮的重连会让服务端反复
  //   建立又踢掉同一 clientId 的连接（正是警告刷屏的直接推手）。
  const PREVIEW_RETRY_MAX = 5;
  function schedulePreviewRetry() {
    if (previewRetryTimer || previewUnloaded) return;
    if (!previewWanted()) return;              // 没人订阅就别重连
    if (previewRetryCount >= PREVIEW_RETRY_MAX) return;
    const delay = Math.min(1000 * Math.pow(2, previewRetryCount), 8000);
    previewRetryCount++;
    previewRetryTimer = setTimeout(() => {
      previewRetryTimer = null;
      if (previewWanted()) ensurePreviewSocket();
    }, delay);
  }

  // 关闭预览连接：优雅关闭（发正常 Close 帧）。
  // ⚠ 不要用「摘掉 onclose 后 close()」的写法：那是把 socket 直接丢弃（传输层硬断），
  //   服务端若正处在推送预览帧的过程中会报 Cannot write to closing transport。
  //   保留 onclose 并通过 previewClosedByUs 抑制重连，才是干净的收尾。
  //   （clientId 现已做到页面实例唯一，正常使用不会再出现「被顶掉」的场景；
  //     此处仍是防御性收尾，确保任何异常路径都不留下悬空连接。）
  function closePreviewSocket() {
    if (previewRetryTimer) { clearTimeout(previewRetryTimer); previewRetryTimer = null; }
    previewRetryCount = 0;
    if (!previewWs) { previewReady = false; return; }
    const ws = previewWs;
    previewWs = null;
    previewReady = false;
    previewClosedByUs = true;
    try {
      if (ws.readyState === 0 || ws.readyState === 1) ws.close(1000, 'client-close');
      else if (ws.readyState === 3) { /* 已关闭，无需处理 */ }
    } catch (e) { /* 忽略：连接可能已失效 */ }
  }

  // 供引擎外部（生图页开关）调用：打开/关闭预览订阅
  function subscribePreview() {
    WB.events._previewSubscribers = (WB.events._previewSubscribers || 0) + 1;
    ensurePreviewSocket();
    return previewReady;
  }
  function unsubscribePreview() {
    WB.events._previewSubscribers = Math.max(0, (WB.events._previewSubscribers || 0) - 1);
    if (WB.events._previewSubscribers === 0) closePreviewSocket();
  }

  // 页面切后台：断掉长连接（ComfyUI 侧的采样不会因此停止，只是不再收预览帧）。
  // 回到前台时若开关仍开着则重新连上，用户无感。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      closePreviewSocket();
    } else if (previewWanted()) {
      ensurePreviewSocket();
    }
  });

  // 页面卸载（刷新 / 关闭 / 进 bfcache）：彻底断连并清空订阅计数，
  // 避免旧连接滞留在 ComfyUI 侧被新页面顶掉（顶掉瞬间的帧推送就是警告的来源）。
  if (WB.pageLifecycle) {
    WB.pageLifecycle.onPageUnload(() => {
      previewUnloaded = true;
      WB.events._previewSubscribers = 0;
      closePreviewSocket();
    });
  }

  WB.engines.register('comfyui', {
    generate, connect, applyModelPreset, matchModelPreset, id: 'comfyui', label: 'ComfyUI',
    detectWorkflowLoaders,
    // 图片反推（engines/caption.js）复用同一条上传链路：dataURL → /upload/image → 文件名
    uploadImage: uploadImageToComfy,
    // 采样预览（K 采样器实时画面）：由生图页「采样预览」开关驱动
    previewApi: {
      clientId: PREVIEW_CLIENT_ID,
      subscribe: subscribePreview,
      unsubscribe: unsubscribePreview,
      isConnected: () => previewReady,
      open: ensurePreviewSocket,
      close: closePreviewSocket
    }
  });
})();
