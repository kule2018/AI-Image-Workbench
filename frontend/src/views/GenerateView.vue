<template>
  <div class="workspace gen">
    <div class="gen-main">
      <div class="gen-row">
        <span class="gen-engine">{{ engineLabel }}</span>
        <button class="btn btn-sm" :disabled="connecting" @click="connect">{{ connecting ? '连接中…' : (connected ? '已连接 ✓' : '连接') }}</button>
        <label class="gen-prev"><input type="checkbox" v-model="showPreview" /> 采样预览</label>
      </div>

      <label class="lbl">正面提示词</label>
      <textarea class="form-textarea" rows="3" v-model="prompt" @paste="handlePaste" placeholder="描述你要生成的画面…（可直接 Ctrl+V 粘贴图片作为参考图）"></textarea>

      <label class="lbl">负面提示词（可选）</label>
      <textarea class="form-textarea" rows="2" v-model="negative" placeholder="不想出现的内容…"></textarea>

      <div class="gen-grid">
        <div class="fld"><span>模型</span>
          <select class="form-input" v-model="model">
            <option value="">— 默认 —</option>
            <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="fld"><span>步数</span><input class="form-input" type="number" v-model="steps" /></div>
        <div class="fld"><span>CFG/引导</span><input class="form-input" type="number" step="0.1" v-model="cfg" /></div>
        <div class="fld"><span>宽</span><input class="form-input" type="number" v-model="width" /></div>
        <div class="fld"><span>高</span><input class="form-input" type="number" v-model="height" /></div>
        <div class="fld"><span>种子</span><div class="seed-row"><input class="form-input" type="number" v-model="seed" /><button class="btn btn-sm" title="随机种子" @click="randomSeed">🎲</button></div></div>
        <div class="fld" v-if="engine !== 'api'"><span>采样器</span>
          <select class="form-input" v-model="sampler"><option v-for="s in samplerOptions" :key="s" :value="s">{{ s }}</option></select>
        </div>
        <div class="fld" v-if="engine !== 'api'"><span>调度器</span>
          <select class="form-input" v-model="scheduler"><option v-for="s in schedulerOptions" :key="s" :value="s">{{ s }}</option></select>
        </div>
        <div class="fld"><span>批量(张)</span><input class="form-input" type="number" min="1" max="8" v-model="batch" /></div>
        <div class="fld" v-if="refImages.length"><span>参考强度</span><input class="form-input" type="number" step="0.05" min="0.05" max="0.99" v-model="refStrength" /></div>
      </div>

      <div class="aspect-row">
        <span class="aspect-label">常用比例</span>
        <button v-for="p in aspectPresets" :key="p.label" class="btn btn-sm ghost" @click="applyAspect(p)">{{ p.label }}</button>
        <span class="ph small">（点击按当前长边套用宽高）</span>
      </div>

      <div class="gen-refs" @dragover.prevent @drop.prevent="handleDrop">
        <button class="btn btn-sm" @click="addRef">＋ 添加参考图</button>
        <div class="ref-thumbs">
          <div v-for="(r, i) in refImages" :key="i" class="ref-thumb">
            <img :src="r" alt="" />
            <button class="ref-x" @click="refImages.splice(i, 1)">×</button>
          </div>
        </div>
      </div>

      <div class="gen-inpaint" v-if="refImages.length">
        <label class="gen-prev"><input type="checkbox" v-model="inpaintMode" /> 局部重绘（在参考图①上涂抹重绘区）</label>
        <button class="btn btn-sm" v-if="inpaintMode" @click="openMaskEditor">✎ 绘制蒙版</button>
        <span v-if="inpaintMode && maskDataUrl" class="ph small">已绘制蒙版 ✓</span>
      </div>

      <div class="gen-lora" v-if="engine !== 'api' && loraList.length">
        <div class="lora-head">
          <span class="lbl">逐图 LoRA</span>
          <span class="ph small">（仅本次生效，覆盖设置页 LoRA）</span>
        </div>
        <div class="lora-row" v-for="(l, i) in loras" :key="i">
          <select class="form-input" v-model="l.name">
            <option value="none">-- 无 --</option>
            <option v-for="m in loraList" :key="m" :value="m">{{ m }}</option>
          </select>
          <label class="lora-str">模型<input class="form-input" type="number" step="0.05" min="0" max="2" v-model.number="l.model" /></label>
          <label class="lora-str" v-if="engine === 'comfyui'">CLIP<input class="form-input" type="number" step="0.05" min="0" max="2" v-model.number="l.clip" /></label>
        </div>
      </div>

      <div class="gen-actions">
        <button class="btn btn-primary btn-lg" :disabled="generating" @click="generate">{{ generating ? '生成中…' : '生成' }}</button>
        <button class="btn" :disabled="generating" @click="clearAll">清空</button>
      </div>
    </div>

    <div class="gen-side">
      <div class="panel">
        <div class="panel-h">预览</div>
        <div class="preview-box">
          <img v-if="previewUrl" :src="previewUrl" alt="采样预览" />
          <span v-else class="ph">采样预览将在此实时显示</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-h">本次结果</div>
        <div class="result-grid">
          <div v-for="(r, i) in results" :key="i" class="result-card">
            <img :src="r.url" alt="" @click="open(r.url)" />
            <button class="icon-btn" title="打开" @click="open(r.url)">↗</button>
            <button class="icon-btn" title="下载" @click="download(r.url)">↓</button>
            <button class="icon-btn" title="发送到画布" @click="sendToCanvas(r.url)">🖼</button>
          </div>
          <div v-if="!results.length" class="ph small">生成结果将显示在这里</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-h">
          历史
          <button class="btn btn-sm ghost" @click="refreshHistory">刷新</button>
          <button class="btn btn-sm ghost danger" @click="clearHistory">清空</button>
        </div>
        <div class="hist-list">
          <div v-for="h in history" :key="h.timestamp" class="hist-item">
            <img :src="(h.image_items && h.image_items[0] && h.image_items[0].url) || h.images[0]" alt="" @click="open((h.image_items && h.image_items[0] && h.image_items[0].url) || h.images[0])" />
            <div class="hist-meta" @click="loadFromHistory(h)" style="cursor:pointer">
              <div class="hist-prompt" :title="h.prompt">{{ h.prompt || '（无提示词）' }}</div>
              <div class="hist-sub">{{ fmt(h.timestamp) }}</div>
            </div>
            <button class="icon-btn" title="载入参数" @click="loadFromHistory(h)">↺</button>
            <button class="icon-btn" title="删除" @click="delHist(h.timestamp)">🗑</button>
          </div>
          <div v-if="!history.length" class="ph small">暂无历史</div>
        </div>
      </div>
    </div>

    <div class="mask-modal" v-if="maskEditorOpen" @click.self="closeMaskEditor">
      <div class="mask-box">
        <div class="panel-h">
          绘制蒙版（白色＝要重绘的区域）
          <button class="btn btn-sm ghost" @click="clearMask">清除</button>
          <button class="btn btn-sm" @click="saveMask">保存</button>
          <button class="btn btn-sm ghost" @click="closeMaskEditor">取消</button>
        </div>
        <div class="mask-stage">
          <img :src="refImages[0]" class="mask-base" alt="" />
          <canvas ref="maskCanvas" class="mask-overlay"
            @pointerdown="maskDown" @pointermove="maskMove" @pointerup="maskUp" @pointerleave="maskUp"></canvas>
        </div>
        <div class="mask-tools">
          <label>笔刷大小 <input type="range" min="5" max="160" v-model.number="brushSize" /></label>
          <span class="ph small">在左侧原图上按住拖动涂抹；保存后本次生成将仅重绘白色区域并贴回原图</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';

const route = useRoute();
const { settings } = useSettings();
const { toast, confirm, pickFiles, fileToDataUrl } = useUi();
const WB = window.WB;

const engine = ref(route.meta.engine || 'comfyui');
const engineLabel = computed(() => ({ comfyui: 'ComfyUI', sd: 'SD WebUI', api: '云端 API' }[engine.value] || engine.value));

const prompt = ref('');
const negative = ref('');
const model = ref('');
const steps = ref(20);
const cfg = ref('7');
const width = ref(1024);
const height = ref(1024);
const seed = ref(0);
const sampler = ref('');
const scheduler = ref('');
const batch = ref(1);
const refStrength = ref(0.75);
const refImages = ref([]);
const loras = ref([
  { name: 'none', model: 1, clip: 1 },
  { name: 'none', model: 1, clip: 1 },
  { name: 'none', model: 1, clip: 1 },
  { name: 'none', model: 1, clip: 1 },
]);
const loraList = computed(() => {
  const s = settings;
  return engine.value === 'sd' ? (s.sdLoraList || []) : (s.comfyLoraList || []);
});
const inpaintMode = ref(false);
const maskDataUrl = ref('');
const maskEditorOpen = ref(false);
const brushSize = ref(50);
const maskCanvas = ref(null);
let maskCtx = null;
let maskNatW = 0, maskNatH = 0;
let drawing = false;

const showPreview = ref(true);
const generating = ref(false);
const connecting = ref(false);
const connected = computed(() => {
  if (engine.value === 'comfyui') return !!settings.comfyConnected;
  if (engine.value === 'sd') return !!settings.sdConnected;
  return !!settings.otherApiUrl;
});
const previewUrl = ref('');
const results = ref([]);
const history = ref([]);

const samplerOptions = computed(() => {
  if (engine.value === 'sd') return settings.sdSamplerList || [];
  return ['euler', 'euler_ancestral', 'heun', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde', 'ddim', 'uni_pc', 'lcm'];
});
const schedulerOptions = ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'ddim_uniform'];
const modelOptions = computed(() => {
  const s = settings;
  if (engine.value === 'comfyui') return s.comfyModelFormat === 'DDUF' ? (s.comfyUNETList || []) : (s.comfyCheckpointList || []);
  if (engine.value === 'sd') return s.sdModelList || [];
  return s.otherApiModels || (s.otherApiPresets && s.otherApiPresets[s.otherApiPresetId] && s.otherApiPresets[s.otherApiPresetId].models) || [];
});

const aspectPresets = [
  { label: '1:1', r: 1 }, { label: '3:2', r: 3 / 2 }, { label: '2:3', r: 2 / 3 },
  { label: '16:9', r: 16 / 9 }, { label: '9:16', r: 9 / 16 },
];
function applyAspect(p) {
  const longEdge = Math.max(Number(width.value) || 0, Number(height.value) || 0, 1024);
  let w, h;
  if (p.r >= 1) { w = longEdge; h = Math.round(longEdge / p.r); } else { h = longEdge; w = Math.round(longEdge * p.r); }
  const a8 = (v) => Math.max(64, Math.round(v / 8) * 8);
  width.value = a8(w); height.value = a8(h);
}

function loadDefaults() {
  const s = settings;
  if (engine.value === 'comfyui') {
    steps.value = s.comfySteps; cfg.value = s.comfyCfgScale; width.value = s.comfyWidth; height.value = s.comfyHeight;
    seed.value = s.comfySeed; sampler.value = s.comfyuisamplerName; scheduler.value = s.comfyScheduler; model.value = s.MODEL_NAME;
  } else if (engine.value === 'sd') {
    steps.value = s.sdSteps; cfg.value = s.sdCfgScale; width.value = s.sdWidth; height.value = s.sdHeight;
    seed.value = s.sdSeed; sampler.value = s.sdSamplerName; scheduler.value = s.sdScheduler; model.value = s.sdModel;
  } else if (engine.value === 'api') {
    steps.value = s.otherApiSteps; cfg.value = s.otherApiGuidanceScale; width.value = s.otherApiWidth; height.value = s.otherApiHeight;
    seed.value = s.otherApiSeed; batch.value = s.otherApiBatchSize; model.value = s.otherApiModel;
  }
}

watch(() => route.meta.engine, async (e) => {
  if (!e) return;
  engine.value = e;
  previewUrl.value = ''; results.value = [];
  await ensureConnected();
  refreshHistory();
}, { immediate: true });

// 进入页面/切换引擎时静默自动连接，便于拉取模型列表（失败不影响手动连接）
async function ensureConnected() {
  try { await WB.engines.autoConnect(engine.value); } catch (e) { /* 忽略 */ }
  loadDefaults();
}

// 参考图或开关变化即清空已有蒙版，避免误用旧蒙版
watch(refImages, () => { maskDataUrl.value = ''; });
watch(inpaintMode, (v) => { if (!v) maskDataUrl.value = ''; });

let offPreview = null, offEnd = null;
function subscribePreview() {
  const eng = WB.engines.registry[engine.value];
  if (eng && eng.previewApi) eng.previewApi.subscribe();
  offPreview = WB.events.on('comfy-preview', (p) => { previewUrl.value = p.dataUrl; });
  offEnd = WB.events.on('comfy-preview-end', () => { previewUrl.value = ''; });
}
function unsubscribePreview() {
  const eng = WB.engines.registry[engine.value];
  if (eng && eng.previewApi) eng.previewApi.unsubscribe();
  if (offPreview) offPreview();
  if (offEnd) offEnd();
  offPreview = offEnd = null;
}

async function connect() {
  connecting.value = true;
  try {
    const ok = await WB.engines.autoConnect(engine.value);
    toast(ok ? engineLabel.value + ' 连接成功' : engineLabel.value + ' 连接失败（请检查设置中的地址）', ok ? 'success' : 'error');
    if (ok) loadDefaults();
    refreshHistory();
  } finally { connecting.value = false; }
}

async function addRef() {
  pickFiles('image/*', async (files) => {
    for (const f of files) { try { refImages.value.push(await fileToDataUrl(f)); } catch (e) { toast('读取失败：' + e.message, 'error'); } }
  });
}

// 拖拽 / 粘贴图片作为参考图
async function handleFiles(fileList) {
  for (const f of fileList) {
    if (!f || !f.type || !f.type.startsWith('image/')) continue;
    try { refImages.value.push(await fileToDataUrl(f)); } catch (e) { toast('读取失败：' + e.message, 'error'); }
  }
}
function handleDrop(e) {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) handleFiles(dt.files);
}
function handlePaste(e) {
  const cd = e.clipboardData || window.clipboardData;
  if (!cd || !cd.items) return;
  const files = [];
  for (const it of cd.items) if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) files.push(f); }
  if (files.length) { e.preventDefault(); handleFiles(files); toast('已粘贴 ' + files.length + ' 张图片为参考图'); }
}

function randomSeed() { seed.value = Math.floor(Math.random() * 4294967295); }

// ---------- 蒙版编辑器（局部重绘） ----------
async function openMaskEditor() {
  maskEditorOpen.value = true;
  await nextTick();
  const img = new Image();
  img.onload = () => {
    maskNatW = img.naturalWidth; maskNatH = img.naturalHeight;
    const c = maskCanvas.value;
    c.width = maskNatW; c.height = maskNatH;
    maskCtx = c.getContext('2d');
    maskCtx.fillStyle = '#000'; maskCtx.fillRect(0, 0, maskNatW, maskNatH);
    if (maskDataUrl.value) {
      const m = new Image();
      m.onload = () => maskCtx.drawImage(m, 0, 0);
      m.src = maskDataUrl.value;
    }
  };
  img.src = refImages.value[0];
}
function maskScale() {
  const c = maskCanvas.value; const r = c.getBoundingClientRect();
  return { sx: c.width / r.width, sy: c.height / r.height };
}
function maskPos(e) {
  const c = maskCanvas.value; const r = c.getBoundingClientRect();
  const s = maskScale();
  return { x: (e.clientX - r.left) * s.sx, y: (e.clientY - r.top) * s.sy };
}
function paint(e) {
  if (!drawing || !maskCtx) return;
  const p = maskPos(e);
  const s = maskScale();
  maskCtx.fillStyle = '#fff';
  maskCtx.beginPath();
  maskCtx.arc(p.x, p.y, Math.max(2, brushSize.value * s.sx), 0, Math.PI * 2);
  maskCtx.fill();
}
function maskDown(e) { drawing = true; paint(e); }
function maskMove(e) { if (drawing) paint(e); }
function maskUp() { drawing = false; }
function clearMask() { if (maskCtx) { maskCtx.fillStyle = '#000'; maskCtx.fillRect(0, 0, maskNatW, maskNatH); } }
function saveMask() { if (maskCanvas.value) maskDataUrl.value = maskCanvas.value.toDataURL('image/png'); maskEditorOpen.value = false; }
function closeMaskEditor() { maskEditorOpen.value = false; }

function clearAll() { prompt.value = ''; negative.value = ''; refImages.value = []; results.value = []; previewUrl.value = ''; }

async function generate() {
  if (!prompt.value.trim() && !refImages.value.length) { toast('请输入提示词或添加参考图', 'error'); return; }
  const rawBatch = Math.max(1, Math.min(8, Math.floor(Number(batch.value) || 1)));
  // API 引擎自身支持批量（请求体 ${n} 占位符），交由引擎原生分批，避免外层循环再乘一次；
  // comfyui / sd 无原生批量，用外层循环 N 次实现。
  const loopN = engine.value === 'api' ? 1 : rawBatch;
  const apiBatch = engine.value === 'api' ? rawBatch : 1;
  generating.value = true; previewUrl.value = ''; results.value = [];
  if (showPreview.value && engine.value === 'comfyui') subscribePreview();
  try {
    const task = {
      engine: engine.value,
      prompt: prompt.value,
      negativePrompt: negative.value,
      refImages: refImages.value.slice(),
      refMasks: (inpaintMode.value && maskDataUrl.value) ? [maskDataUrl.value] : [],
      refStrength: Number(refStrength.value) || 0.75,
      loras: engine.value === 'api' ? [] : loras.value.filter(l => l.name && l.name !== 'none').map(l => ({ name: l.name, model: Number(l.model) || 1, clip: Number(l.clip) || 1 })),
      overrides: {
        steps: Number(steps.value) || 20,
        cfg: Number(cfg.value) || 7,
        width: Number(width.value) || 1024,
        height: Number(height.value) || 1024,
        seed: Number(seed.value) || 0,
        sampler: sampler.value,
        scheduler: scheduler.value,
        model: model.value,
        batchSize: apiBatch,
      },
    };
    let total = 0;
    for (let i = 0; i < loopN; i++) {
      const res = await WB.engines.generate(task);
      for (const url of (res.images || [])) results.value.push({ url, meta: res.meta });
      await saveToHistory(res);
      total += (res.images || []).length;
    }
    toast('生成完成（' + total + ' 张）', 'success');
  } catch (e) {
    toast('生成失败：' + (e && e.message ? e.message : e), 'error');
  } finally {
    generating.value = false;
    if (showPreview.value && engine.value === 'comfyui') unsubscribePreview();
  }
}

async function saveToHistory(res) {
  try {
    await WB.history.add({
      engine: engine.value,
      prompt: prompt.value,
      finalPrompt: (res.meta && res.meta.finalPrompt) || prompt.value,
      negativePrompt: negative.value,
      model: model.value,
      params: { steps: steps.value, cfg: cfg.value, width: width.value, height: height.value, seed: seed.value, sampler: sampler.value, scheduler: scheduler.value },
      images: res.images || [],
    });
    await refreshHistory();
  } catch (e) { /* 忽略 */ }
}

async function refreshHistory() {
  try { history.value = (await WB.history.list(engine.value, 50)).slice().reverse(); } catch (e) { history.value = []; }
}
async function clearHistory() {
  if (!(await confirm('确定清空全部历史？'))) return;
  await WB.history.clear();
  history.value = [];
}
async function delHist(ts) {
  await WB.history.remove([ts]);
  history.value = history.value.filter((h) => h.timestamp !== ts);
}
function open(url) { if (url) window.open(url, '_blank'); }
function download(url) {
  const a = document.createElement('a');
  a.href = url; a.download = 'wb_' + Date.now() + '.png'; a.click();
}
// 生图结果一键发送到「生图草稿」画布（与画布编辑器联动）
async function sendToCanvas(url) {
  try {
    const draftId = 'draft';
    let full = await WB.api.canvasGet(draftId);
    if (!full || typeof full !== 'object') {
      full = { id: draftId, title: '生图草稿', nodes: [], edges: [], background: '#0d0d12' };
    }
    if (!Array.isArray(full.nodes)) full.nodes = [];
    if (!Array.isArray(full.edges)) full.edges = [];
    const k = full.nodes.length % 6;
    full.nodes.push({
      id: 'n' + Date.now(), type: 'image', title: '生成图',
      image: url, x: 80 + k * 30, y: 80 + k * 30,
    });
    await WB.api.canvasSave(full);
    toast('已发送到画布「生图草稿」');
  } catch (e) { toast('发送失败：' + e.message, 'error'); }
}
function loadFromHistory(h) {
  prompt.value = h.prompt || '';
  negative.value = h.negativePrompt || '';
  const p = h.params || {};
  if (p.steps) steps.value = p.steps;
  if (p.cfg) cfg.value = p.cfg;
  if (p.width) width.value = p.width;
  if (p.height) height.value = p.height;
  if (p.seed) seed.value = p.seed;
  if (p.sampler) sampler.value = p.sampler;
  if (p.scheduler) scheduler.value = p.scheduler;
  if (h.model) model.value = h.model;
  toast('已载入选中历史的参数');
}
function fmt(t) { return t ? new Date(t).toLocaleString() : ''; }

onUnmounted(unsubscribePreview);
</script>

<style scoped>
.gen { display: grid; grid-template-columns: minmax(360px, 1fr) 340px; gap: 16px; align-items: start; }
.gen-main { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.gen-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.gen-engine { font-weight: 700; font-size: 15px; }
.gen-prev { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-2); margin-left: auto; }
.lbl { display: block; font-size: 12px; color: var(--text-2); margin: 10px 0 4px; }
.gen-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 6px; }
.aspect-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.aspect-label { font-size: 12px; color: var(--text-2); }
.aspect-row .ghost { padding: 2px 8px; }
.fld { display: flex; flex-direction: column; gap: 3px; }
.fld > span { font-size: 11px; color: var(--text-2); }
.gen-refs { margin-top: 12px; }
.gen-inpaint { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.gen-lora { margin-top: 12px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--panel-2); }
.lora-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.lora-head .lbl { font-size: 13px; font-weight: 600; }
.lora-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.lora-row .form-input { flex: 1; min-width: 0; }
.lora-str { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.lora-str .form-input { width: 70px; }
.seed-row { display: flex; gap: 4px; }
.seed-row .form-input { flex: 1; }
.mask-modal { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; }
.mask-box { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; width: min(92vw, 640px); }
.mask-stage { position: relative; margin: 10px 0; max-height: 60vh; overflow: auto; background: #000; border-radius: 8px; }
.mask-stage .mask-base { display: block; width: 100%; }
.mask-stage .mask-overlay { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; opacity: .6; }
.mask-tools { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-2); flex-wrap: wrap; }
.ref-thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.ref-thumb { position: relative; width: 64px; height: 64px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.ref-thumb img { width: 100%; height: 100%; object-fit: cover; }
.ref-x { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,.6); color: #fff; border: 0; border-radius: 4px; width: 18px; height: 18px; line-height: 16px; cursor: pointer; }
.gen-actions { display: flex; gap: 10px; margin-top: 16px; }
.btn-lg { flex: 1; }
.gen-side { display: flex; flex-direction: column; gap: 14px; }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
.panel-h { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.panel-h .btn { margin-left: auto; }
.panel-h .danger { color: #e06; }
.preview-box { aspect-ratio: 1/1; background: var(--panel-2); border: 1px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.preview-box img { max-width: 100%; max-height: 100%; }
.result-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.result-card { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); aspect-ratio: 1/1; }
.result-card img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; }
.hist-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow: auto; }
.hist-item { display: flex; gap: 8px; align-items: center; }
.hist-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; cursor: zoom-in; }
.hist-meta { flex: 1; min-width: 0; }
.hist-prompt { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hist-sub { font-size: 11px; color: var(--text-2); }
.ph { color: var(--text-2); font-size: 12px; }
.ph.small { padding: 10px; text-align: center; width: 100%; }
</style>
