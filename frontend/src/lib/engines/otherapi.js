// ============================================================
// AI图片工作台 - 云端API引擎（移植自文生图工具2.0 的 otherApi() + pollCustomAsyncResult + _extractImageFromJson）
// 参考图合并：生图页传入（优先）+ 氛围参考图 otherApiImages（随预设保存）——对齐原插件 refSrc 合并
// 自定义请求体占位符系统：${model}/${prompt}/${negative_prompt}/${size}/${size_star}/${steps}/${guidance}/${seed}/${n}/${ref_images}/${ref_images_dashscope}/${ref_images_api}/${api_key}/${url}
// 异步规则：请求体含 poll 配置即为异步任务，按 poll 定义轮询
// ============================================================
'use strict';

(function () {
  const { toast, sleep } = WB.util;
  const S = () => WB.settings.all();

  // ---------- 深度取值工具（移植自插件 _getPath/_findValueByKeys） ----------
  function getPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function findValueByKeys(node, keys, depth) {
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 8) return undefined;
    for (const k of keys) {
      if (node[k] !== undefined && node[k] !== null && node[k] !== '') return node[k];
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === 'object') {
        const found = findValueByKeys(v, keys, depth + 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  // === COMMENT-STRIP-START ===
  // 自定义请求体允许写注释（与 ComfyUI 工作流的注释支持保持一致）：剔除 // 行注释、/* */ 块注释。
  // 请求体在替换占位符后会被整体 JSON.parse 提交给接口，写注释会直接解析失败；
  // 这里统一清洗，扫描时跳过字符串字面量，避免误伤 "http://..." 这类内容。
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
  // === COMMENT-STRIP-END ===

  // ---------- 通用响应图片提取（移植自插件 _extractImageFromJson） ----------
  function extractImageFromJson(json) {
    if (!json || typeof json !== 'object') return null;
    if (Array.isArray(json.output_images) && json.output_images.length) {
      const o = json.output_images[0];
      if (typeof o === 'string' && o) return o;
      if (o && typeof o === 'object') return o.url || o.b64_json || o.img || o.image || null;
    }
    if (Array.isArray(json.images_urls) && json.images_urls.length) {
      const o = json.images_urls[0];
      if (typeof o === 'string' && o) return o;
    }
    if (typeof json.url === 'string' && json.url) return json.url;
    if (typeof json.data === 'string' && json.data.length > 10) return json.data;
    if (json.data && typeof json.data === 'object') {
      const d = json.data;
      const v = d.img || d.image || d.b64 || d.base64 || d.b64_json || d.url || d.image_url;
      if (typeof v === 'string' && v) return v;
    }
    if (Array.isArray(json.images) && json.images.length) {
      const f = json.images[0];
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object') return f.url || f.b64_json || f.img || f.image || null;
    }
    if (json.output && typeof json.output === 'object') {
      const o = json.output;
      const v = o.img || o.image || o.base64 || o.url || o.b64_json;
      if (typeof v === 'string' && v) return v;
      if (Array.isArray(o.results) && o.results.length) {
        const r = o.results[0];
        if (typeof r === 'string') return r;
        if (r && typeof r === 'object') return r.url || r.img || r.image || null;
      }
    }
    if (typeof json.result === 'string' && json.result) return json.result;
    const top = json.img || json.image || json.b64 || json.base64 || json.b64_json;
    if (typeof top === 'string' && top) return top;
    if (typeof json.image_url === 'string' && json.image_url) return json.image_url;
    return null;
  }

  // 收集响应中的全部图片（n>1 时服务端返回数组，逐项收集；找不到再退回单图提取）
  // 注意：部分平台（如硅基流动）响应中 images 与 data 两个字段携带同一批图片，
  // 必须按地址去重，否则 n=1 会显示 2 张、n=2 显示 4 张
  function extractImagesFromJson(json) {
    if (!json || typeof json !== 'object') return [];
    const out = [];
    const seen = new Set();
    const push = (v) => {
      if (!v) return;
      let u = null;
      if (typeof v === 'string') u = v;
      else if (typeof v === 'object') {
        u = v.url || v.b64_json || v.img || v.image;
      }
      if (typeof u === 'string' && u && !seen.has(u)) { seen.add(u); out.push(u); }
    };
    if (Array.isArray(json.data)) json.data.forEach(push);
    if (Array.isArray(json.images)) json.images.forEach(push);
    if (Array.isArray(json.output_images)) json.output_images.forEach(push);
    if (Array.isArray(json.images_urls)) json.images_urls.forEach(push);
    // data 为对象时深入其内部数组（LiblibAI 风格：{code, msg, data:{generateUuid, images:[...]}}）
    if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
      if (Array.isArray(json.data.images)) json.data.images.forEach(push);
      if (Array.isArray(json.data.image_urls)) json.data.image_urls.forEach(push);
      if (Array.isArray(json.data.output_images)) json.data.output_images.forEach(push);
    }
    if (json.output && typeof json.output === 'object') {
      if (Array.isArray(json.output.results)) json.output.results.forEach(push);
      if (Array.isArray(json.output.choices)) {
        for (const c of json.output.choices) {
          const content = (c.message && c.message.content) || [];
          for (const item of content) {
            if (item && item.image) push(item.image);
            else if (item && item.text && item.text.startsWith('http')) push(item.text);
          }
        }
      }
    }
    if (Array.isArray(json.output)) json.output.forEach(push);
    if (!out.length) {
      const one = extractImageFromJson(json);
      if (one) out.push(one);
    }
    return out;
  }

  // 把图片地址解析为 dataURL（远程 URL 经代理下载转 base64，dataURL 原样返回）
  async function resolveImage(imageUrl) {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('data:')) return imageUrl;
    if (!/^https?:\/\//.test(imageUrl)) {
      // base64 裸数据
      if (imageUrl.length > 200) return 'data:image/png;base64,' + imageUrl;
      return imageUrl;
    }
    try {
      const r = await WB.http.request({ method: 'GET', url: imageUrl, responseType: 'binary', timeout: 120000 });
      const mime = r.contentType && r.contentType.startsWith('image/') ? r.contentType.split(';')[0] : 'image/png';
      return 'data:' + mime + ';base64,' + r.base64;
    } catch (e) {
      console.warn('图片下载失败，返回原 URL:', e.message);
      return imageUrl;
    }
  }

  // ---------- 自定义 poll 轮询（移植自插件 pollCustomResult） ----------
  async function pollCustomResult(taskId, apiKey, pollCfg, onProgress) {
    const pollUrlTpl = pollCfg.url || '';
    const pollMethod = String(pollCfg.method || 'GET').toUpperCase();
    const interval = parseInt(pollCfg.interval) || 3000;
    const maxAttempts = parseInt(pollCfg.maxAttempts) || 120;
    const tryFields = Array.isArray(pollCfg.imageFields) ? pollCfg.imageFields : (pollCfg.imageField ? [pollCfg.imageField] : []);
    const imagesField = pollCfg.imagesField;
    const statusField = pollCfg.statusField;
    const successValues = (Array.isArray(pollCfg.successValues) ? pollCfg.successValues : []).map(x => String(x).toLowerCase());
    const failValues = (Array.isArray(pollCfg.failValues) ? pollCfg.failValues : []).map(x => String(x).toLowerCase());
    const pollHeaders = Object.assign(
      { 'Content-Type': 'application/json' },
      apiKey ? { 'Authorization': 'Bearer ' + apiKey } : {},
      (pollCfg.headers && typeof pollCfg.headers === 'object') ? pollCfg.headers : {}
    );
    const pollBodyTpl = pollCfg.body ? JSON.stringify(pollCfg.body) : '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (onProgress) onProgress(attempt + 1);
      const url = String(pollUrlTpl).replace(/\$\{task_id\}/g, taskId);
      let data;
      if (pollBodyTpl && pollMethod !== 'GET') {
        const bodyStr = pollBodyTpl.replace(/\$\{task_id\}/g, taskId);
        try { data = JSON.stringify(JSON.parse(bodyStr)); } catch (e) { data = bodyStr; }
      }
      let result;
      try {
        const r = await WB.http.request({ method: pollMethod, url, headers: pollHeaders, data, timeout: 30000 });
        result = JSON.parse(r.text);
      } catch (e) { await sleep(interval); continue; }

      const urls = [];
      for (const f of tryFields) {
        const v = getPath(result, f);
        if (typeof v === 'string' && v) { urls.push(v); break; }
      }
      if (!urls.length && imagesField) {
        const arr = getPath(result, imagesField);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (typeof item === 'string' && item) urls.push(item);
            else if (item && typeof item === 'object' && (item.url || item.b64_json)) urls.push(item.url || item.b64_json);
          }
        }
      }
      if (!urls.length) {
        const u = findValueByKeys(result, ['url', 'b64_json', 'image_url', 'images_url', 'image', 'output_images']);
        if (typeof u === 'string' && u) urls.push(u);
      }
      if (urls.length) {
        // 去重后逐张解析（同一地址可能在多个字段出现）
        const outs = [];
        for (const u of [...new Set(urls)]) outs.push(await resolveImage(u));
        return outs;
      }

      let status = statusField ? getPath(result, statusField) : undefined;
      if (status === undefined || status === null || status === '') {
        status = findValueByKeys(result, ['task_status', 'status', 'state']);
      }
      const st = status != null ? String(status).toLowerCase() : '';
      if (st && failValues.length && failValues.some(v => st.includes(v))) {
        throw new Error('异步任务失败: ' + (typeof result.message === 'string' ? result.message : (typeof result.error === 'string' ? result.error : st)));
      }
      await sleep(interval);
    }
    throw new Error('异步任务超时');
  }

  // ---------- 生成 ----------
  async function generate(task) {
    const s = S();
    const preset = s.otherApiPresets[s.otherApiPresetId] || {};
    const ov = task.overrides || {};

    // 对齐插件：引擎读运行时键（编辑即时生效），null（未同步过）时回退预设字段
    let apiUrl = ((s.otherApiUrl !== null && s.otherApiUrl !== undefined && s.otherApiUrl !== '') ? s.otherApiUrl : (preset.url || '')).replace(/\/+$/, '');
    // Key 随预设走（对齐插件）：运行时 Key 优先，为空时回退预设内 Key
    const apiKey = s.otherApiKey || preset.key || '';
    if (!apiKey) throw new Error('请先在「API 设置」中填写 API Key');
    if (!apiUrl) throw new Error('当前预设未配置接口地址，请到「API 设置」检查预设');
    // flat 格式自动补全 /images/generations（移植自插件，兼容旧版；已有生图接口路径则不追加）
    if ((preset.bodyFormat || 'flat') === 'flat' && !/\bimage(s)?\/generations\/?$/i.test(apiUrl) && !/\/?generations\/?$/i.test(apiUrl)) {
      apiUrl = apiUrl + '/images/generations';
    }
    const model = ov.model ?? s.otherApiModel ?? preset.model ?? '';

    const width = parseInt(ov.width ?? s.otherApiWidth) || 1024;
    const height = parseInt(ov.height ?? s.otherApiHeight) || 1024;
    const imageSize = width + 'x' + height;
    const steps = parseInt(ov.steps ?? s.otherApiSteps) || 20;
    const guidance = parseFloat(ov.cfg ?? s.otherApiGuidanceScale) || 7.5;
    const seed = parseInt(ov.seed ?? s.otherApiSeed) || 0;
    const n = parseInt(ov.batchSize ?? s.otherApiBatchSize) || 1;

    // 合并参考图片：生图页传入（优先）+ 氛围参考图（随预设保存）——对齐原插件 otherApi() 的 refSrc 合并
    const refSrc = [...(task.refImages || []), ...(s.otherApiImages || [])];
    const bodyFormat = preset.bodyFormat || 'flat';

    let headers = { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
    let requestBody;
    let customPoll = null;

    // 自定义请求体：运行时键优先（对齐插件 settings.otherApiCustomBody），null 时回退预设字段
    const customBodyStr = (s.otherApiCustomBody === null || s.otherApiCustomBody === undefined) ? (preset.customBody || '') : s.otherApiCustomBody;
    if (customBodyStr && customBodyStr.trim()) {
      // 转义函数：只转义特殊字符（移植自插件）
      const esc = v => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
      // 请求体允许写 // 与 /* */ 注释（与 ComfyUI 工作流一致）：
      // 先剥离注释再替换占位符，避免占位符值里的字符影响注释边界
      const resolved = stripJsonComments(customBodyStr.trim())
        .replace(/\$\{url\}/g, esc(apiUrl))
        .replace(/\$\{model\}/g, esc(model))
        .replace(/\$\{prompt\}/g, esc(task.prompt || ''))
        .replace(/\$\{negative_prompt\}/g, esc(task.negativePrompt || ''))
        .replace(/\$\{size\}/g, esc(imageSize))
        .replace(/\$\{size_star\}/g, esc(imageSize.replace(/x/gi, '*')))
        .replace(/\$\{steps\}/g, String(steps))
        .replace(/\$\{guidance\}/g, String(guidance))
        .replace(/\$\{seed\}/g, String(seed))
        .replace(/\$\{n\}/g, String(n))
        .replace(/\$\{ref_images\}/g, JSON.stringify(refSrc))
        .replace(/\$\{ref_images_dashscope\}/g, refSrc.length
          ? refSrc.map(img => JSON.stringify({ image: img })).join(',\n          ') + ',' : '')
        .replace(/\$\{ref_images_api\}/g, refSrc.length
          ? '"images": ' + JSON.stringify(refSrc) + ',\n    ' : '')
        .replace(/\$\{api_key\}/g, esc(apiKey));
      const parsed = JSON.parse(resolved);
      if (parsed && typeof parsed === 'object') {
        // 完整配置模式：{url, headers, body, poll}
        const isFull = parsed.url && parsed.body;
        if (isFull) {
          if (parsed.url) apiUrl = parsed.url;
          if (parsed.headers && typeof parsed.headers === 'object') Object.assign(headers, parsed.headers);
          requestBody = parsed.body;
          // 图生图字段为空数组时移除：如火山引擎 "image": [] 会被当作空输入，返回空白占位图
          for (const k of ['image', 'images', 'image_url']) {
            if (Array.isArray(requestBody[k]) && !requestBody[k].length) delete requestBody[k];
          }
          if (parsed.poll && typeof parsed.poll === 'object') { customPoll = parsed.poll; }
        } else {
          requestBody = parsed;
          for (const k of ['image', 'images', 'image_url']) {
            if (Array.isArray(requestBody[k]) && !requestBody[k].length) delete requestBody[k];
          }
        }
      }
    } else {
      // 无自定义请求体：按 bodyFormat 构建请求体（四分支对齐原插件 otherApi()）
      if (bodyFormat === 'simple') {
        // 极简格式：仅 model + prompt
        requestBody = { model, prompt: task.prompt };
      } else if (bodyFormat === 'dashscope') {
        // 阿里云百炼 multimodal-generation 格式（对齐原插件：size 用 * 分隔，固定 prompt_extend/watermark）
        const userPrompt = (task.prompt || '').trim() || 'generate an image';
        requestBody = {
          model,
          input: { messages: [{ role: 'user', content: [{ text: userPrompt }] }] },
          parameters: {
            size: imageSize.replace(/x/gi, '*'),
            n,
            prompt_extend: true,
            watermark: false,
            negative_prompt: task.negativePrompt || ''
          }
        };
      } else if (bodyFormat === 'qianfan') {
        // 百度千帆格式（对齐原插件：guidance 兜底 4，steps 兜底 50，negative_prompt 恒携带）
        requestBody = {
          model,
          prompt: (task.prompt || '').trim() || 'generate an image',
          size: imageSize,
          n,
          steps: parseInt(s.otherApiSteps) || 50,
          guidance: parseFloat(s.otherApiGuidanceScale) || 4,
          prompt_extend: true,
          negative_prompt: task.negativePrompt || ''
        };
      } else {
        // flat 格式：标准 API 兼容格式（字段名对齐原插件：batch_size / num_inference_steps）
        requestBody = {
          model,
          prompt: task.prompt,
          n,
          size: imageSize,
          image_size: imageSize,
          batch_size: n,
          num_inference_steps: steps,
          guidance_scale: guidance
        };
        if (seed > 0) requestBody.seed = seed;
        if (task.negativePrompt) requestBody.negative_prompt = task.negativePrompt;
      }
      // 参考图合并（对齐原插件：simple/dashscope 不带图，其余格式带前 3 张）
      if (refSrc.length && bodyFormat !== 'simple' && bodyFormat !== 'dashscope') {
        requestBody.images = refSrc.slice(0, 3);
      }
    }

    const r = await WB.http.request({
      method: 'POST', url: apiUrl, headers,
      data: JSON.stringify(requestBody), timeout: 600000
    });
    const result = JSON.parse(r.text);

    // 异步模式：提取 task_id 并轮询
    if (customPoll) {
      let taskId = customPoll.taskIdField ? getPath(result, customPoll.taskIdField) : undefined;
      if (taskId === undefined || taskId === null || taskId === '') {
        taskId = findValueByKeys(result, ['generateUuid', 'task_id', 'id']);
      }
      if (taskId) {
        const immediate = extractImagesFromJson(result);
        if (immediate.length) {
          const outs = [];
          for (const u of immediate) outs.push(await resolveImage(u));
          return { images: outs, meta: { engine: 'api', taskId } };
        }
        const imgs = await pollCustomResult(taskId, apiKey, customPoll, task.onProgress);
        if (!imgs.length) throw new Error('异步任务获取结果失败');
        return { images: imgs, meta: { engine: 'api', taskId } };
      }
    }

    // 同步模式：多格式解析（移植自插件），收集响应中的全部图片
    let urls = extractImagesFromJson(result);
    if (!urls.length) throw new Error('未能从响应中获取图片\n响应: ' + JSON.stringify(result).slice(0, 400));
    urls = urls.map(u => u.startsWith('/') ? new URL(apiUrl).origin + u : u);

    const displays = [];
    for (const u of urls) displays.push(await resolveImage(u));
    return { images: displays, meta: { engine: 'api' } };
  }

  // ---------- 拉取模型列表（移植自插件 otherApiConnectHandler 的多 URL 尝试） ----------
  // 内置平台地址栏是「带版本前缀的基址」（如 .../api/v1、.../v2、.../api/v3），
  // 这里按站点根 + 常见版本路径 + 平台专用路径组合候选，依次尝试；识别到平台时附上其鉴权头。
  async function fetchModels(baseUrl) {
    const s = S();
    const key = s.otherApiKey || '';
    const clean = String(baseUrl || '').replace(/\/+$/, '');
    let host = '';
    try { host = new URL(clean).hostname; } catch (e) { /* 忽略 */ }
    // 站点根：剥掉末尾 /api/v1、/v1、/api/v3、/v2 等版本前缀
    const root = clean.replace(/\/(api\/)?v\d+$/i, '');

    const c = [];
    const push = (u) => { if (u) c.push(u); };
    // 平台专用（最可靠，优先）
    if (host.includes('siliconflow.cn')) push('https://api.siliconflow.cn/v1/models');
    if (host.includes('dashscope.aliyuncs.com')) {
      push('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
      push('https://dashscope.aliyuncs.com/api/v1/models');
    }
    if (host.includes('qianfan.baidubce.com')) push('https://qianfan.baidubce.com/v2/models');
    if (host.includes('modelscope.cn')) push('https://api-inference.modelscope.cn/v1/models');
    // 通用候选（站点根 + 常见版本路径）
    push(root + '/v1/models');
    push(root + '/compatible-mode/v1/models');
    push(root + '/api/v1/models');
    push(root + '/api/v3/models');
    push(root + '/v2/models');
    // 通用候选（基址尾部直接叠加）
    push(clean + '/v1/models');
    push(clean + '/models');
    push(clean + '/api/models');
    push(clean + '/api/v1/models');
    // 兜底：插件老逻辑里的硅基专用路径
    push('https://api.siliconflow.cn/v1/models');

    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    // DashScope 原生接口较旧版本认 X-DashScope-APIKey，两种都带，保兼容
    if (host.includes('dashscope.aliyuncs.com') && key) headers['X-DashScope-APIKey'] = key;

    let lastErr = null;
    for (const url of [...new Set(c)]) {
      try {
        const r = await WB.http.request({ method: 'GET', url, headers, timeout: 20000 });
        const data = JSON.parse(r.text);
        const arr = data.data || data.models || data.result || data.list || data.items || data.modelList || [];
        const names = arr.map(m => typeof m === 'string' ? m : (m.id || m.model_id || m.name || m.model_name || m.model || m.title)).filter(Boolean);
        if (names.length) return names;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('未能获取模型列表');
  }

  WB.engines.register('api', { generate, fetchModels, id: 'api', label: 'API 生图' });
})();
