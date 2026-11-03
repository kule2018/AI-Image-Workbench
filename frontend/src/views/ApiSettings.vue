<template>
  <div class="workspace">
    <div class="settings-page two-col">
      <div class="col-left">
        <section class="section">
          <div class="section-title">连接设置</div>
          <div class="field">
            <label class="form-label">预设选择</label>
            <select class="form-select" :value="settings.otherApiPresetId" @change="onPresetChange($event.target.value)">
              <option value="">-- 选择预设 --</option>
              <optgroup label="内置平台">
                <option v-for="k in builtinPresetNames" :key="k" :value="k" :selected="k === settings.otherApiPresetId">{{ k }}</option>
              </optgroup>
              <optgroup label="自定义预设" v-if="customPresetNames.length">
                <option v-for="k in customPresetNames" :key="k" :value="k" :selected="k === settings.otherApiPresetId">{{ k }}</option>
              </optgroup>
            </select>
          </div>
          <div class="preset-actions">
            <button class="btn btn-sm btn-primary" @click="savePreset">💾 保存预设</button>
            <button class="btn btn-sm" @click="newPreset">➕ 新建预设</button>
            <button class="btn btn-sm btn-danger" @click="delPreset" :disabled="isBuiltin">🗑 删除预设</button>
            <button class="btn btn-sm" @click="importPreset">📥 导入预设</button>
            <button class="btn btn-sm" @click="exportPreset">📤 导出预设</button>
          </div>
          <div class="form-grid-3" style="margin-top:5px">
            <div class="field"><label class="form-label">API 地址</label>
              <input type="text" class="form-input" :readonly="isBuiltin" :style="isBuiltin ? 'background:var(--panel-2)' : ''"
                :value="urlVal" @change="update('otherApiUrl', $event.target.value.trim())" placeholder="输入API地址"></div>
            <div class="field"><label class="form-label">密钥</label>
              <input type="password" class="form-input" :value="keyVal" @change="update('otherApiKey', $event.target.value.trim())" placeholder="YOUR-API-KEY"></div>
            <div class="field"><label class="form-label">模型选择</label>
              <div class="field-row">
                <input type="text" class="form-input" style="flex:1" :value="modelVal" @change="update('otherApiModel', $event.target.value.trim())" placeholder="点击选择模型">
                <button class="btn btn-sm btn-primary" @click="connect" style="white-space:nowrap">连接</button>
              </div></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">生成参数</div>
          <div class="form-grid-3">
            <div class="field"><label class="form-label">宽度</label><input class="form-input" :value="settings.otherApiWidth" @change="update('otherApiWidth', $event.target.value)"></div>
            <div class="field"><label class="form-label">高度</label><input class="form-input" :value="settings.otherApiHeight" @change="update('otherApiHeight', $event.target.value)"></div>
            <div class="field"><label class="form-label">步数</label><input class="form-input" :value="settings.otherApiSteps" @change="update('otherApiSteps', $event.target.value)"></div>
            <div class="field"><label class="form-label">引导系数</label><input class="form-input" :value="settings.otherApiGuidanceScale" @change="update('otherApiGuidanceScale', $event.target.value)"></div>
            <div class="field"><label class="form-label">种子</label><input class="form-input" :value="settings.otherApiSeed" @change="update('otherApiSeed', $event.target.value)"></div>
            <div class="field"><label class="form-label">批次大小</label><input class="form-input" :value="settings.otherApiBatchSize" @change="update('otherApiBatchSize', $event.target.value)"></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">模型列表</div>
          <div class="collapse-panel open">
            <div class="pool-header">
              <input class="form-input" v-model="manualModel" placeholder="手动输入模型名后点添加" style="flex:1">
              <button class="btn btn-sm" @click="addManual">＋ 添加</button>
              <button class="btn btn-sm" @click="fetchModels">⟳ 拉取模型</button>
            </div>
            <div class="pool-list">
              <div v-if="!pool.length" class="pool-empty">当前预设暂无模型，请拉取或手动添加</div>
              <div v-for="m in pool" :key="m" class="pool-item">
                <span class="pool-name">{{ m }}</span>
                <button class="pool-del" @click="delModel(m)" title="删除">✕</button>
              </div>
            </div>
            <div v-if="candidates.length">
              <label class="form-label" style="margin-top:10px">候选模型（点击加入当前预设的模型池）</label>
              <input class="form-input" v-model="candidateFilter" placeholder="🔍 输入关键词过滤候选模型" style="margin:6px 0 0">
              <div class="candidate-list">
                <div v-for="n in filteredCandidates" :key="n" class="candidate-item" :class="{ added: pool.includes(n) }" @click="addCandidate(n)">
                  <span style="flex:1;word-break:break-all">{{ n }}</span><span>{{ pool.includes(n) ? '已加入' : '＋' }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">氛围参考图（生图时自动并入参考图，随预设保存）</div>
          <div class="vibe-thumbs">
            <div v-for="(u, i) in vibeImages" :key="i" class="vibe-thumb">
              <img :src="u" alt=""><button class="vibe-del" @click="delVibe(i)" title="删除">✕</button>
            </div>
            <div class="vibe-thumb vibe-add" @click="addVibe" title="上传氛围参考图"><span style="font-size:22px;line-height:1">＋</span><span style="font-size:11px">上传</span></div>
          </div>
          <div class="preset-actions" style="align-items:center">
            <button class="btn btn-sm" @click="addVibe">⬆ 上传氛围参考图</button>
            <span class="hint" style="margin:0;flex:1">共 {{ vibeImages.length }} 张 · 随当前预设保存与切换</span>
          </div>
        </section>
      </div>

      <div class="col-right">
        <section class="section-divider fill">
          <div class="section-title" style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:10px">自定义请求体</div>
          <p class="hint">修改后可替代上方参数生图，请求体含 poll 即异步轮询，不含则为同步，留空则自动根据参数生成。</p>
          <div class="field fill-body" style="margin-top:8px">
            <label class="form-label">请求体（JSON）</label>
            <textarea class="form-textarea" style="font-family:'Courier New',monospace;font-size:11.5px;line-height:1.5;white-space:pre;background:var(--panel-2)"
              :readonly="!editingBody" v-model="bodyText"></textarea>
          </div>
          <div class="preset-actions">
            <button class="btn btn-sm btn-primary" v-if="!editingBody" @click="editBody" :disabled="isBuiltin">✏️ 修改自定义请求体</button>
            <button class="btn btn-sm" v-if="editingBody" @click="confirmBody">✓ 确认修改</button>
            <span style="flex:1"></span>
            <button class="btn btn-sm" @click="resetBody" :disabled="isBuiltin">🔄 重置为默认请求体</button>
          </div>
        </section>
        <div class="reset-row"><button class="btn btn-sm" @click="resetDefaults">🔄 重设默认值</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';

const { settings, update } = useSettings();
const ui = useUi();

const builtinPresets = window.WB.presets.builtinOtherApiPresets();
const builtinPresetNames = Object.keys(builtinPresets);
const customPresetNames = computed(() => Object.keys(settings.otherApiPresets || {}).filter(k => !builtinPresets[k]));
const isBuiltin = computed(() => window.WB.presets.manager.isBuiltinApiPreset(settings.otherApiPresetId));

const curPreset = computed(() => settings.otherApiPresets[settings.otherApiPresetId] || {});
const urlVal = computed(() => (settings.otherApiUrl != null ? settings.otherApiUrl : (curPreset.value.url || '')));
const keyVal = computed(() => settings.otherApiKey || curPreset.value.key || '');
const modelVal = computed(() => settings.otherApiModel || curPreset.value.model || '');
const bodyText = ref((settings.otherApiCustomBody != null ? settings.otherApiCustomBody : (curPreset.value.customBody || '')));
watch(
  () => [settings.otherApiPresetId, settings.otherApiCustomBody, curPreset.value.customBody],
  () => { if (!editingBody.value) bodyText.value = (settings.otherApiCustomBody != null ? settings.otherApiCustomBody : (curPreset.value.customBody || '')); },
  { deep: true },
);

const editingBody = ref(false);
const manualModel = ref('');
const candidates = ref([]);
const candidateFilter = ref('');

const pool = computed(() => {
  const p = settings.otherApiPresets[settings.otherApiPresetId];
  if (!p) return [];
  if (!Array.isArray(p.models)) p.models = [];
  return p.models;
});
const filteredCandidates = computed(() => {
  const f = candidateFilter.value.trim().toLowerCase();
  return f ? candidates.value.filter(n => String(n).toLowerCase().includes(f)) : candidates.value;
});
const vibeImages = computed(() => settings.otherApiImages || []);

function onPresetChange(id) {
  if (!id) return;
  window.WB.presets.manager.switchApiPreset(id);
  editingBody.value = false;
  ui.toast('已切换到预设「' + id + '」（URL/Key/模型/参数/请求体已同步）');
}
function savePreset() {
  const id = settings.otherApiPresetId;
  if (isBuiltin.value) {
    curPreset.value.key = keyVal.value.trim();
    curPreset.value.model = modelVal.value.trim();
    update('otherApiKey', curPreset.value.key);
    window.WB.settings.save(['otherApiPresets', 'otherApiKey']);
    ui.toast('内置平台「' + id + '」的 Key/模型已保存');
    return;
  }
  settings.otherApiPresets[id] = collectPreset();
  update('otherApiKey', settings.otherApiPresets[id].key);
  ui.toast('预设「' + id + '」已保存');
}
function collectPreset() {
  const c = curPreset.value || {};
  return Object.assign({}, c, {
    url: urlVal.value.trim(), key: keyVal.value.trim(), model: modelVal.value.trim(),
    imageSize: (settings.otherApiWidth || 1024) + 'x' + (settings.otherApiHeight || 1024),
    width: settings.otherApiWidth || 1024, height: settings.otherApiHeight || 1024,
    batchSize: settings.otherApiBatchSize || 1, steps: settings.otherApiSteps || 20,
    guidanceScale: settings.otherApiGuidanceScale || 7.5, seed: settings.otherApiSeed || 0,
    images: vibeImages.value, customBody: bodyText.value,
  });
}
async function newPreset() {
  const name = await ui.prompt('输入新预设名称：');
  if (!name) return;
  if (settings.otherApiPresets[name]) { ui.toast('预设名称「' + name + '」已存在', 'error'); return; }
  settings.otherApiPresets[name] = collectPreset();
  settings.otherApiPresets[name].models = [];
  settings.otherApiPresetId = name;
  window.WB.settings.save(['otherApiPresets', 'otherApiPresetId']);
}
async function delPreset() {
  const id = settings.otherApiPresetId;
  if (isBuiltin.value) { ui.toast('内置平台预设不可删除', 'error'); return; }
  if (!(await ui.confirm('确定删除预设「' + id + '」？'))) return;
  delete settings.otherApiPresets[id];
  settings.otherApiPresetId = Object.keys(settings.otherApiPresets)[0];
  window.WB.settings.save(['otherApiPresets', 'otherApiPresetId']);
  window.WB.presets.manager.switchApiPreset(settings.otherApiPresetId);
}
function importPreset() {
  ui.pickJsonFile((data) => {
    const r = window.WB.presets.manager.importApiPresets(data);
    if (r.last) { ui.toast('预设「' + r.last + '」已导入并应用'); }
    else ui.toast('未识别的预设格式', 'error');
  });
}
function exportPreset() { ui.download('api_preset_' + settings.otherApiPresetId + '.json', window.WB.presets.manager.exportApiPreset(settings.otherApiPresetId)); }
async function connect() {
  update('otherApiUrl', urlVal.value.trim());
  update('otherApiKey', keyVal.value.trim());
  update('otherApiModel', modelVal.value.trim());
  try {
    const names = await window.WB.engines.registry.api.fetchModels(urlVal.value.trim());
    candidates.value = names;
    candidateFilter.value = '';
    ui.toast('连接成功，拉取到 ' + names.length + ' 个模型，加入模型池后将在选择框中 ★ 置顶');
  } catch (e) { ui.toast('连接失败：' + e.message, 'error'); }
}
async function fetchModels() {
  try {
    const url = urlVal.value.trim();
    update('otherApiUrl', url);
    const names = await window.WB.engines.registry.api.fetchModels(url);
    candidates.value = names;
    ui.toast('拉取到 ' + names.length + ' 个模型');
  } catch (e) { ui.toast('拉取失败：' + e.message, 'error'); }
}
function savePool() { window.WB.settings.save('otherApiPresets'); }
function addManual() {
  const v = manualModel.value.trim();
  if (!v || pool.value.includes(v)) return;
  pool.value.push(v);
  manualModel.value = '';
  savePool();
}
function delModel(m) {
  const i = pool.value.indexOf(m);
  if (i >= 0) { pool.value.splice(i, 1); savePool(); }
}
function addCandidate(n) {
  if (pool.value.includes(n)) return;
  pool.value.push(n);
  savePool();
}
function addVibe() {
  ui.pickFiles('image/*', async (files) => {
    const imgs = settings.otherApiImages || [];
    for (const f of files) imgs.push(await ui.fileToDataUrl(f));
    settings.otherApiImages = imgs;
    update('otherApiImages', imgs);
    ui.toast('氛围参考图已添加');
  });
}
function delVibe(i) {
  const imgs = settings.otherApiImages || [];
  imgs.splice(i, 1);
  update('otherApiImages', imgs);
}
function editBody() { if (isBuiltin.value) return; editingBody.value = true; }
function confirmBody() {
  update('otherApiCustomBody', bodyText.value);
  editingBody.value = false;
  ui.toast('请求体已生效（点「保存预设」后写入预设）');
}
async function resetBody() {
  if (isBuiltin.value) return;
  if (!(await ui.confirm('重置为默认请求体？（清空自定义请求体，留空时引擎按参数自动生成）'))) return;
  bodyText.value = '';
  update('otherApiCustomBody', '');
  ui.toast('请求体已清空');
}
async function resetDefaults() {
  if (!(await ui.confirm('确定重设生成参数为默认值？（连接设置与 URL/Key 不会被重置；氛围参考图将同时清空）'))) return;
  const D = { otherApiWidth: '1216', otherApiHeight: '832', otherApiSteps: '20', otherApiGuidanceScale: '7.5', otherApiSeed: '0', otherApiBatchSize: '1' };
  for (const [k, v] of Object.entries(D)) update(k, v);
  settings.otherApiImages = [];
  update('otherApiImages', []);
  ui.toast('已重设默认值');
}

onMounted(() => { /* 预设已在 init 时同步 */ });
</script>
