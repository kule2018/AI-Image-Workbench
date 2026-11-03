// ============================================================
// AI图片工作台 - SD WebUI 引擎（移植自文生图工具2.0 的 sd()）
// 支持文生图与 img2img（第一张参考图做底图，参考强度=重绘幅度）
// ============================================================
'use strict';

(function () {
  const { toast } = WB.util;
  const S = () => WB.settings.all();

  // LoRA 拼接到提示词（移植自插件 buildSdLoraPrompt，SD 只用模型强度）
  // lorasOverride：逐图 LoRA 覆盖（来自 task.loras，形如 [{name, model}]）；为空则回退设置页 sdLora1-4
  function buildSdLoraPrompt(lorasOverride) {
    let loraPrompt = '';
    if (Array.isArray(lorasOverride) && lorasOverride.length) {
      lorasOverride.forEach((l) => {
        if (l && l.name && l.name !== 'none' && l.name !== '') {
          const strength = Number(l.model ?? l.modelStrength) || 1;
          loraPrompt += `<lora:${l.name}:${strength}>`;
        }
      });
    } else {
      for (let i = 1; i <= 4; i++) {
        const loraName = S()[`sdLora${i}`];
        if (loraName && loraName !== 'none' && loraName !== '') {
          const strength = S()[`sdLora${i}ModelStrength`] || 1;
          loraPrompt += `<lora:${loraName}:${strength}>`;
        }
      }
    }
    return loraPrompt;
  }

  async function generate(task) {
    const sdUrl = (S().sdUrl || 'http://localhost:7860').trim().replace(/\/+$/, '');
    if (!sdUrl) throw new Error('请先在「SD WebUI 设置」中配置 API 地址');

    // 参数：task 覆盖 > settings
    const ov = task.overrides || {};
    const steps = parseInt(ov.steps ?? S().sdSteps) || 20;
    const cfgScale = parseFloat(ov.cfg ?? S().sdCfgScale) || 7;
    const width = parseInt(ov.width ?? S().sdWidth) || 512;
    const height = parseInt(ov.height ?? S().sdHeight) || 768;
    const samplerName = ov.sampler ?? S().sdSamplerName ?? 'DPM++ 2M';
    const scheduler = ov.scheduler ?? S().sdScheduler ?? 'Karras';
    const seedRaw = ov.seed ?? S().sdSeed ?? -1;
    const seed = (seedRaw === '' || seedRaw === 0 || seedRaw === '0') ? -1 : parseInt(seedRaw) || -1;

    let prompt = task.prompt || '';
    const loraPrompt = buildSdLoraPrompt(task.loras);
    if (loraPrompt) prompt = prompt + ', ' + loraPrompt;
    const negative_prompt = task.negativePrompt || '';

    const payload = {
      prompt, negative_prompt,
      steps: Number(steps),
      sampler_name: samplerName,
      scheduler,
      width: Number(width), height: Number(height),
      cfg_scale: Number(cfgScale),
      seed
    };

    // img2img：第一张参考图做底图
    const refImages = task.refImages || [];
    let endpoint = '/sdapi/v1/txt2img';
    if (refImages.length > 0) {
      endpoint = '/sdapi/v1/img2img';
      payload.init_images = [refImages[0]];
      payload.denoising_strength = Math.min(Math.max(parseFloat(task.refStrength ?? 0.75), 0.05), 0.99);
    }

    const r = await WB.http.request({
      method: 'POST', url: sdUrl + endpoint,
      data: JSON.stringify(payload), timeout: 300000
    });
    const resp = JSON.parse(r.text);
    if (!resp.images || !resp.images.length) throw new Error('SD WebUI 未返回图片数据');

    const images = resp.images.map(i => 'data:image/png;base64,' + i);
    return { images, meta: { engine: 'sd', endpoint, info: resp.info || '' } };
  }

  // 连接并刷新模型/采样器/LoRA列表（移植自插件 sdConnectHandler 的请求部分）
  async function connect(silent) {
    const sdUrl = (S().sdUrl || 'http://localhost:7860').trim().replace(/\/+$/, '');
    const get = async (path) => {
      const r = await WB.http.request({ method: 'GET', url: sdUrl + path, timeout: 15000 });
      return JSON.parse(r.text);
    };
    const models = await get('/sdapi/v1/sd-models');
    const modelList = models.map(m => m.model_name || m.title).filter(Boolean).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
    let samplerList = [];
    try { samplerList = (await get('/sdapi/v1/samplers')).map(s => s.name).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }); } catch (e) { /* 可选 */ }
    let loraList = [];
    try { loraList = (await get('/sdapi/v1/loras')).map(l => l.name).sort((a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }); } catch (e) { /* 可选 */ }

    const keys = [];
    WB.settings.set('sdModelList', modelList, false);
    WB.settings.set('sdSamplerList', samplerList, false);
    WB.settings.set('sdLoraList', loraList, false);
    if (modelList.length && !modelList.includes(S().sdModel)) {
      WB.settings.set('sdModel', modelList[0], false); keys.push('sdModel');
    }
    WB.settings.set('sdConnected', true, false);
    WB.settings.save(['sdModelList', 'sdSamplerList', 'sdLoraList', 'sdConnected'].concat(keys));
    if (!silent) WB.util.toast('SD WebUI 连接成功，获取到 ' + modelList.length + ' 个模型');
    return true;
  }

  WB.engines.register('sd', { generate, connect, id: 'sd', label: 'SD WebUI' });
})();
