<template>
  <div class="workspace">
    <div class="cv-page">
      <div class="cv-toolbar">
        <h3 class="cv-title">无限画布</h3>
        <div class="cv-tools">
          <div class="seg">
            <button :class="{ active: mode === 'visual' }" @click="setMode('visual')">可视化</button>
            <button :class="{ active: mode === 'json' }" @click="setMode('json')">JSON</button>
          </div>
          <template v-if="mode === 'visual'">
            <button class="btn" @click="zoomOut">－</button>
            <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
            <button class="btn" @click="zoomIn">＋</button>
            <button class="btn" @click="zoomReset">重置</button>
            <button class="btn" :class="{ active: linking }" @click="toggleLink">🔗 连线</button>
            <button class="btn" @click="exportPng">⬇ 导出 PNG</button>
          </template>
          <button class="btn btn-primary" @click="create">➕ 新建画布</button>
          <button class="btn" :disabled="!active" @click="save">💾 保存</button>
          <button class="btn btn-danger" :disabled="!active" @click="delActive">🗑 删除</button>
        </div>
      </div>
      <p class="hint" style="margin:0 0 12px">可视化模式：拖动节点移动、点击选中编辑；开启「连线」后依次点两个节点建立连接；可缩放、导出 PNG。</p>
      <div class="cv-body">
        <div class="cv-side">
          <div v-for="c in list" :key="c.id" :class="['cv-item', active && active.id === c.id ? 'on' : '']" @click="open(c)">
            <span class="cv-name">{{ c.title || c.id }}</span>
            <span class="cv-meta">{{ fmt(c.updated_at) }}</span>
          </div>
          <div v-if="!list.length" class="empty">暂无画布</div>
        </div>
        <div class="cv-main" v-if="active">
          <div class="cv-head">
            <input class="form-input" v-model="active.title" placeholder="画布标题" @input="dirty = true" />
            <span class="hint">{{ dirty ? '● 未保存' : '已同步' }}</span>
            <template v-if="mode === 'visual'">
              <button class="btn btn-sm" @click="addNode">➕ 节点</button>
              <button class="btn btn-sm" :disabled="!sel" @click="delNode">删除节点</button>
            </template>
          </div>

          <div class="cv-edit" v-if="mode === 'visual'">
            <div class="cv-surface" ref="surfaceRef" @pointerdown.self="onSurfaceDown">
              <div class="cv-zoom" ref="zoomLayer" :style="{ transform: `scale(${zoom})`, width: viewW + 'px', height: viewH + 'px' }">
                <svg class="cv-edges">
                  <line v-for="(e, i) in edgesView" :key="i" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
                </svg>
                <div v-for="n in active.nodes" :key="n.id"
                     class="cv-node" :class="{ sel: sel && sel.id === n.id, link: linking && linkSrc && linkSrc.id === n.id, img: n.type === 'image' }"
                     :style="{ left: n.x + 'px', top: n.y + 'px' }"
                     @pointerdown.stop="startDrag($event, n)" @click.stop="onNodeClick(n)">
                  <div class="cv-node-h">{{ n.title || n.type || '节点' }}</div>
                  <div class="cv-node-b" v-if="n.image"><img :src="n.image" class="cv-node-img" alt="" /></div>
                  <div class="cv-node-b" v-else>{{ n.text || '（空）' }}</div>
                </div>
                <div v-if="!active.nodes.length" class="cv-empty">点击「➕ 节点」添加第一个节点</div>
              </div>
            </div>
            <div class="cv-node-edit" v-if="sel">
              <div class="field"><label class="form-label">标题</label><input class="form-input" v-model="sel.title" @input="dirty = true" /></div>
              <div class="field"><label class="form-label">类型</label><input class="form-input" v-model="sel.type" @input="dirty = true" /></div>
              <div class="field"><label class="form-label">图片地址</label><input class="form-input" v-model="sel.image" @input="dirty = true" placeholder="可粘贴图片 URL / dataURL" /></div>
              <div class="field"><label class="form-label">内容</label><textarea class="form-textarea" rows="4" v-model="sel.text" @input="dirty = true"></textarea></div>
            </div>
          </div>

          <textarea v-else class="form-textarea cv-json" v-model="jsonText" @input="dirty = true" spellcheck="false"></textarea>
        </div>
        <div class="cv-main empty" v-else>从左侧选择或新建一个画布</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUi } from '../composables/useUi';

const { toast, confirm, prompt } = useUi();
const WB = window.WB;

const list = ref([]);
const active = ref(null);
const jsonText = ref('');
const dirty = ref(false);
const mode = ref('visual');
const sel = ref(null);
const surfaceRef = ref(null);
const zoomLayer = ref(null);
const zoom = ref(1);
const viewW = 2400;
const viewH = 1600;
const linking = ref(false);
const linkSrc = ref(null);
let drag = null;

async function load() { list.value = await WB.api.canvasList(); }
function fmt(t) { return t ? new Date(t).toLocaleString() : ''; }

async function create() {
  const id = await prompt('画布 ID（唯一）：', 'canvas_' + Date.now());
  if (!id) return;
  const title = await prompt('画布标题：', id);
  if (title === null) return;
  const data = { id, title, nodes: [], edges: [], background: '#0d0d12' };
  await WB.api.canvasSave(data);
  toast('已新建画布');
  await load();
  open({ id });
}
async function open(c) {
  const full = await WB.api.canvasGet(c.id);
  active.value = full || { id: c.id, title: c.title, nodes: [], edges: [], background: '#0d0d12' };
  if (!active.value.nodes) active.value.nodes = [];
  if (!active.value.edges) active.value.edges = [];
  jsonText.value = JSON.stringify(active.value, null, 2);
  sel.value = null; linking.value = false; linkSrc.value = null; dirty.value = false;
}
async function save() {
  try {
    const payload = mode.value === 'json' ? JSON.parse(jsonText.value) : active.value;
    const saved = { id: active.value.id, ...payload };
    await WB.api.canvasSave(saved);
    active.value = saved;
    dirty.value = false;
    toast('画布已保存');
    await load();
  } catch (e) { toast('保存失败：' + e.message, 'error'); }
}
async function delActive() {
  if (!(await confirm('确定删除画布「' + (active.value.title || active.value.id) + '」？'))) return;
  await WB.api.canvasDelete(active.value.id);
  active.value = null; toast('已删除'); await load();
}

function setMode(m) {
  if (m === 'json') {
    jsonText.value = JSON.stringify(active.value, null, 2);
  } else {
    try {
      const o = JSON.parse(jsonText.value);
      if (o) { active.value = o; if (!active.value.nodes) active.value.nodes = []; if (!active.value.edges) active.value.edges = []; }
    } catch (e) { /* 保留当前 */ }
  }
  mode.value = m;
}

function addNode() {
  if (!active.value) return;
  active.value.nodes.push({ id: 'n' + Date.now(), type: 'text', title: '新节点', text: '', x: 140, y: 120 });
  dirty.value = true;
}
function delNode() {
  if (!sel.value) return;
  active.value.nodes = active.value.nodes.filter((n) => n.id !== sel.value.id);
  active.value.edges = (active.value.edges || []).filter((e) => e.from !== sel.value.id && e.to !== sel.value.id);
  sel.value = null; dirty.value = true;
}

const edgesView = computed(() => {
  if (!active.value) return [];
  const map = {};
  (active.value.nodes || []).forEach((n) => { map[n.id] = n; });
  const cx = (n) => n.x + (n.type === 'image' ? 120 : 100);
  return (active.value.edges || [])
    .map((e) => {
      const a = map[e.from], b = map[e.to];
      if (!a || !b) return null;
      return { x1: cx(a), y1: a.y + 18, x2: cx(b), y2: b.y + 18 };
    })
    .filter(Boolean);
});

function startDrag(e, n) {
  if (linking.value) return; // 连线模式不拖动
  sel.value = n;
  const r = zoomLayer.value.getBoundingClientRect();
  const sx = (e.clientX - r.left) / zoom.value;
  const sy = (e.clientY - r.top) / zoom.value;
  drag = { n, rect: r, offx: sx - n.x, offy: sy - n.y };
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag);
}
function onDrag(e) {
  if (!drag) return;
  const sx = (e.clientX - drag.rect.left) / zoom.value;
  const sy = (e.clientY - drag.rect.top) / zoom.value;
  drag.n.x = Math.max(0, sx - drag.offx);
  drag.n.y = Math.max(0, sy - drag.offy);
  dirty.value = true;
}
function endDrag() {
  drag = null;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', endDrag);
}

function onNodeClick(n) {
  if (linking.value) {
    if (!linkSrc.value) { linkSrc.value = n; }
    else if (linkSrc.value.id !== n.id) {
      active.value.edges = active.value.edges || [];
      active.value.edges.push({ from: linkSrc.value.id, to: n.id });
      dirty.value = true; linkSrc.value = null; linking.value = false;
      toast('已添加连接');
    }
    return;
  }
  sel.value = n;
}
function onSurfaceDown() {
  sel.value = null;
  if (linking.value) linkSrc.value = null;
}
function toggleLink() { linking.value = !linking.value; linkSrc.value = null; }

function zoomIn() { zoom.value = Math.min(3, +(zoom.value + 0.1).toFixed(2)); }
function zoomOut() { zoom.value = Math.max(0.2, +(zoom.value - 0.1).toFixed(2)); }
function zoomReset() { zoom.value = 1; }

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
async function exportPng() {
  try {
    const nodes = active.value.nodes || [];
    const map = {}; nodes.forEach((n) => { map[n.id] = n; });
    const c = document.createElement('canvas');
    c.width = viewW; c.height = viewH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = active.value.background || '#0d0d12';
    ctx.fillRect(0, 0, viewW, viewH);
    // 连线
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2;
    (active.value.edges || []).forEach((e) => {
      const a = map[e.from], b = map[e.to];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x + 100, a.y + 18);
      ctx.lineTo(b.x + 100, b.y + 18);
      ctx.stroke();
    });
    // 节点
    for (const n of nodes) {
      const w = n.type === 'image' ? 240 : 200;
      const h = n.image ? 180 : 64;
      ctx.fillStyle = '#1b1b22'; ctx.fillRect(n.x, n.y, w, h);
      ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 1; ctx.strokeRect(n.x, n.y, w, h);
      if (n.image) {
        try { const im = await loadImg(n.image); ctx.drawImage(im, n.x, n.y, w, h); } catch (e) { /* 跳过 */ }
      }
      ctx.fillStyle = '#e5e7eb'; ctx.font = '13px sans-serif';
      ctx.fillText(n.title || n.type || '节点', n.x + 8, n.y + 20);
      if (!n.image) {
        ctx.fillStyle = '#9ca3af'; ctx.font = '12px sans-serif';
        ctx.fillText(String(n.text || '').slice(0, 30), n.x + 8, n.y + 42);
      }
    }
    const a = document.createElement('a');
    a.download = 'canvas_' + (active.value.id || 'export') + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
    toast('已导出 PNG');
  } catch (e) { toast('导出失败：' + e.message, 'error'); }
}

onUnmounted(endDrag);
onMounted(load);
</script>

<style scoped>
.cv-page { height: 100%; display: flex; flex-direction: column; }
.cv-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px; flex-wrap: wrap; }
.cv-title { margin: 0; font-size: 16px; }
.cv-tools { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.zoom-label { font-size: 12px; color: var(--text-2); min-width: 38px; text-align: center; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { background: var(--panel); color: var(--text); border: 0; padding: 7px 14px; cursor: pointer; font-size: 13px; }
.seg button.active { background: var(--accent); color: #fff; }
.btn.active { background: var(--accent); color: #fff; }
.cv-body { display: flex; gap: 12px; flex: 1; min-height: 0; }
.cv-side { width: 240px; border: 1px solid var(--border); border-radius: 10px; padding: 8px; overflow: auto; background: var(--panel); }
.cv-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.cv-item:hover { background: var(--panel-2); }
.cv-item.on { background: var(--accent); color: #fff; }
.cv-name { font-size: 13px; font-weight: 600; }
.cv-meta { font-size: 11px; opacity: 0.7; }
.cv-main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cv-head { display: flex; align-items: center; gap: 10px; }
.cv-head .form-input { flex: 0 0 280px; }
.cv-edit { flex: 1; display: flex; gap: 12px; min-height: 0; }
.cv-surface { position: relative; flex: 1; border: 1px solid var(--border); border-radius: 8px; overflow: auto; min-height: 420px; background: #0a0a0f; }
.cv-zoom { position: relative; transform-origin: 0 0; }
.cv-edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.cv-edges line { stroke: var(--accent); stroke-width: 2; }
.cv-node { position: absolute; width: 200px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.3); cursor: grab; user-select: none; }
.cv-node.sel { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.cv-node.link { border-color: #ffb020; box-shadow: 0 0 0 2px #ffb020; }
.cv-node.img { width: 240px; }
.cv-node-h { padding: 6px 8px; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--border); }
.cv-node-b { padding: 6px 8px; font-size: 12px; color: var(--text-2); white-space: pre-wrap; max-height: 120px; overflow: hidden; }
.cv-node-img { width: 100%; display: block; border-radius: 6px; }
.cv-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text-2); pointer-events: none; }
.cv-node-edit { width: 240px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: var(--panel); display: flex; flex-direction: column; gap: 8px; overflow: auto; }
.cv-json { flex: 1; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; }
.empty { color: var(--text-2); padding: 40px; text-align: center; width: 100%; }
</style>
