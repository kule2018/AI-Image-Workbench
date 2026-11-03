<template>
  <div class="workspace">
    <div class="settings-page two-col">
      <div class="col-left">
        <section class="section">
          <div class="section-title">连接设置</div>
          <div class="field">
            <label class="form-label">工作流预设</label>
            <select class="form-select" :value="settings.workerid" @change="onWorkerChange($event.target.value)">
              <option v-for="(w, name) in settings.workers" :key="name" :value="name" :selected="name === settings.workerid">{{ name }}{{ w.builtin ? '（内置）' : '' }}</option>
            </select>
          </div>
          <div class="preset-actions">
            <button class="btn btn-sm btn-primary" @click="newWorker">➕ 新建预设</button>
            <button class="btn btn-sm btn-primary" @click="saveSnap">💾 保存预设</button>
            <button class="btn btn-sm btn-danger" @click="delWorker">🗑️ 删除预设</button>
            <button class="btn btn-sm" @click="importWorker">📥 导入预设</button>
            <button class="btn btn-sm" @click="exportWorker">📤 导出预设</button>
          </div>
          <div class="field-row" style="margin-top:5px">
            <div class="field" style="flex:1;min-width:0">
              <label class="form-label">ComfyUI API地址</label>
              <input type="text" class="form-input" v-model="urlInput" placeholder="例如 http://127.0.0.1:8188" @change="update('comfyUrl', urlInput)">
            </div>
            <div class="field" style="flex:0 0 118px">
              <label class="form-label">模型格式</label>
              <select class="form-select" :value="settings.comfyModelFormat" @change="onFormatChange($event.target.value)">
                <option value="Checkpoint" :selected="settings.comfyModelFormat !== 'DDUF'">Checkpoint</option>
                <option value="DDUF" :selected="settings.comfyModelFormat === 'DDUF'">DDUF</option>
              </select>
            </div>
            <div class="field" style="flex:1;min-width:0">
              <label class="form-label">模型选择
                <span class="badge" :class="settings.comfyConnected ? 'ok' : 'bad'">{{ settings.comfyConnected ? '已连接' : '未连接' }}</span>
              </label>
              <div class="field-row">
                <select class="form-select" style="flex:1;min-width:0" :value="settings.MODEL_NAME" @change="onModelChange($event.target.value)">
                  <option v-if="!fullList && settings.MODEL_NAME" :value="settings.MODEL_NAME" selected>{{ displayName(settings.MODEL_NAME) }}</option>
                  <option v-if="!fullList && !settings.MODEL_NAME" value="">点击连接获取模型列表</option>
                  <template v-for="m in modelList" :key="m">
                    <option :value="m" :selected="m === settings.MODEL_NAME">{{ displayName(m) }}</option>
                  </template>
                </select>
                <button class="btn btn-sm btn-primary" @click="doConnect(false)" style="white-space:nowrap">连接</button>
              </div>
            </div>
          </div>
          <div class="form-grid-3" style="margin-top:8px">
            <div class="field"><label class="form-label">CLIP类型 (DDUF)</label>
              <select class="form-select" :disabled="settings.comfyModelFormat !== 'DDUF'" :value="settings.comfyClipType" @change="update('comfyClipType', $event.target.value)">
                <option value="">未选择</option>
                <option v-for="t in settings.comfyClipTypeOptions" :key="t" :value="t" :selected="t === settings.comfyClipType">{{ t }}</option>
              </select></div>
            <div class="field"><label class="form-label">文本编码器 (DDUF)</label>
              <select class="form-select" :disabled="settings.comfyModelFormat !== 'DDUF'" :value="settings.comfyTextEncoder" @change="update('comfyTextEncoder', $event.target.value)">
                <option value="">未选择</option>
                <option v-for="m in settings.comfyTextEncoderList" :key="m" :value="m" :selected="m === settings.comfyTextEncoder">{{ displayName(m) }}</option>
              </select></div>
            <div class="field"><label class="form-label">VAE (DDUF)</label>
              <select class="form-select" :disabled="settings.comfyModelFormat !== 'DDUF'" :value="settings.comfyVAE" @change="update('comfyVAE', $event.target.value)">
                <option value="">未选择</option>
                <option v-for="m in settings.comfyVAEList" :key="m" :value="m" :selected="m === settings.comfyVAE">{{ displayName(m) }}</option>
              </select></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">生成参数</div>
          <div class="form-grid-3">
            <div class="field"><label class="form-label">宽度</label><input class="form-input" :value="settings.comfyWidth" @change="update('comfyWidth', $event.target.value)"></div>
            <div class="field"><label class="form-label">高度</label><input class="form-input" :value="settings.comfyHeight" @change="update('comfyHeight', $event.target.value)"></div>
            <div class="field"><label class="form-label">步数</label><input class="form-input" :value="settings.comfySteps" @change="update('comfySteps', $event.target.value)"></div>
            <div class="field"><label class="form-label">CFG</label><input class="form-input" :value="settings.comfyCfgScale" @change="update('comfyCfgScale', $event.target.value)"></div>
            <div class="field"><label class="form-label">种子</label><input class="form-input" :value="settings.comfySeed" @change="update('comfySeed', $event.target.value)"></div>
            <div class="field"><label class="form-label">采样器</label>
              <select class="form-select" :value="settings.comfyuisamplerName" @change="update('comfyuisamplerName', $event.target.value)">
                <option v-for="s in samplerOptions" :key="s" :value="s" :selected="s === settings.comfyuisamplerName">{{ s }}</option>
              </select></div>
            <div class="field"><label class="form-label">调度器</label>
              <select class="form-select" :value="settings.comfyScheduler" @change="update('comfyScheduler', $event.target.value)">
                <option v-for="s in schedulerOptions" :key="s" :value="s" :selected="s === settings.comfyScheduler">{{ s }}</option>
              </select></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">LoRA 模型 (可选1-4个)</div>
          <div class="lora-row" v-for="n in [1,2,3,4]" :key="n">
            <select class="form-select" style="flex:1" :value="settings['comfyLora'+n]" @change="update('comfyLora'+n, $event.target.value)">
              <option value="none" :selected="settings['comfyLora'+n] === 'none'">none</option>
              <option v-for="m in settings.comfyLoraList" :key="m" :value="m" :selected="m === settings['comfyLora'+n]">{{ displayName(m) }}</option>
            </select>
            <label class="lora-str">模型<input class="form-input" style="width:64px" type="number" step="0.01" :value="settings['comfyLora'+n+'ModelStrength']" @change="update('comfyLora'+n+'ModelStrength', +$event.target.value)"></label>
            <label class="lora-str">CLIP<input class="form-input" style="width:64px" type="number" step="0.01" :value="settings['comfyLora'+n+'ClipStrength']" @change="update('comfyLora'+n+'ClipStrength', +$event.target.value)"></label>
          </div>
          <div class="reset-row"><button class="btn btn-sm" @click="resetDefaults">🔄 重设默认值</button></div>
        </section>
      </div>

      <div class="col-right">
        <section class="section-divider workflow-panel fill">
          <div class="section-title" style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:10px">工作流内容</div>
          <div class="field fill-body">
            <label class="form-label">工作流内容</label>
            <textarea class="form-textarea" style="font-family:monospace;font-size:11px"
              :value="workerJson" :readonly="currentBuiltin" @change="onWorkerJsonChange"></textarea>
          </div>
        </section>
        <div class="reset-row"><button class="btn btn-sm" @click="resetDefaults">🔄 重设默认值</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';

const { settings, update } = useSettings();
const ui = useUi();
const fullList = ref(false);
const urlInput = ref(settings.comfyUrl);

const displayName = (m) => window.WB.util.displayModelName(m || '');
const modelList = computed(() => settings.comfyModelFormat === 'DDUF' ? (settings.comfyUNETList || []) : (settings.comfyCheckpointList || []));
const workerJson = computed(() => {
  const w = settings.workers[settings.workerid];
  return w ? (w.workflow || '') : '';
});
const currentBuiltin = computed(() => !!(settings.workers[settings.workerid] || {}).builtin);

const samplerOptions = ['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde', 'ddim', 'uni_pc', 'lcm'];
const schedulerOptions = ['simple', 'karras', 'exponential', 'normal', 'ddim_uniform', 'beta'];

function onModelChange(v) {
  update('MODEL_NAME', v);
  if (settings.comfyModelFormat === 'DDUF' && v && window.WB.engines.registry.comfyui.applyModelPreset(v)) refreshAll();
}
function onFormatChange(fmt) {
  update('comfyModelFormat', fmt);
  const list = fmt === 'DDUF' ? (settings.comfyUNETList || []) : (settings.comfyCheckpointList || []);
  if (list.length && !list.includes(settings.MODEL_NAME)) update('MODEL_NAME', list[0]);
  if (fmt === 'DDUF' && settings.MODEL_NAME) window.WB.engines.registry.comfyui.applyModelPreset(settings.MODEL_NAME);
  refreshAll();
}
function onWorkerChange(id) {
  window.WB.presets.manager.switchWorker(id);
  ui.toast('已切换到工作流「' + id + '」（模型/生成参数/LoRA 已同步）');
  refreshAll();
}
function onWorkerJsonChange(e) {
  const w = settings.workers[settings.workerid];
  if (!w) return;
  if (w.builtin) { ui.toast('内置默认工作流不可修改，请使用「新建预设」保存为新工作流', 'error'); return; }
  w.workflow = e.target.value;
  window.WB.settings.save('workers');
  window.WB.presets.manager.fillFromWorkflow(e.target.value);
  refreshAll();
}
async function doConnect(silent) {
  try {
    update('comfyUrl', urlInput.value);
    await window.WB.engines.registry.comfyui.connect(true);
    fullList.value = true;
    if (!silent) ui.toast('ComfyUI 连接成功');
  } catch (e) {
    window.WB.settings.set('comfyConnected', false);
    if (!silent) ui.toast('ComfyUI 连接失败：' + e.message + '\n请确认地址正确且 ComfyUI 已启动', 'error');
  }
  refreshAll();
}
function refreshAll() {
  // 列表来自 settings（响应式），此处仅触发依赖刷新
  fullList.value = fullList.value;
}
async function newWorker() {
  const json = workerJson.value.trim();
  if (!json) { ui.toast('请先粘贴工作流 JSON', 'error'); return; }
  const name = await ui.prompt('输入工作流预设名称：');
  if (!name) return;
  if (settings.workers[name]) { ui.toast('工作流名称「' + name + '」已存在', 'error'); return; }
  settings.workers[name] = { workflow: json, snapshot: window.WB.presets.manager.captureWorkerSnapshot() };
  settings.workerid = name;
  window.WB.settings.save(['workers', 'workerid']);
  window.WB.presets.manager.fillFromWorkflow(json);
  ui.toast('工作流「' + name + '」已创建并应用');
}
function saveSnap() { window.WB.presets.manager.saveWorkerSnapshot(); ui.toast('工作流快照已保存'); }
async function delWorker() {
  const id = settings.workerid;
  if (window.WB.presets.manager.isBuiltinWorker(id)) { ui.toast('内置默认工作流不能删除', 'error'); return; }
  if (!(await ui.confirm('是否确定删除此工作流「' + id + '」？'))) return;
  delete settings.workers[id];
  const fallback = settings.comfyModelFormat === 'DDUF' ? 'DDUF类型文生图模板' : 'Checkpoint类型文生图模板';
  settings.workerid = settings.workers[fallback] ? fallback : Object.keys(settings.workers)[0];
  window.WB.settings.save(['workers', 'workerid']);
  if (settings.workers[settings.workerid]?.snapshot) window.WB.presets.manager.applyWorkerSnapshot(settings.workers[settings.workerid].snapshot);
}
function importWorker() {
  ui.pickJsonFile((data, fileName, rawText) => {
    const r = window.WB.presets.manager.importWorkers(data, (fileName || '导入的工作流').replace(/\.[^/.]+$/, ''), rawText);
    if (r.last) ui.toast('已导入 ' + r.count + ' 个工作流，当前「' + r.last + '」');
    else ui.toast('未识别的工作流格式', 'error');
  });
}
function exportWorker() { ui.download('workflow_' + settings.workerid + '.json', window.WB.presets.manager.exportWorker(settings.workerid)); }
async function resetDefaults() {
  if (!(await ui.confirm('确定将 ComfyUI 生成参数恢复为默认值？（连接设置与模型不会被重置）'))) return;
  const D = { comfyWidth: '1216', comfyHeight: '832', comfySteps: '8', comfyCfgScale: '1', comfySeed: '0', comfyuisamplerName: 'euler_ancestral', comfyScheduler: 'karras', comfyLora1: 'none', comfyLora1ModelStrength: 1, comfyLora1ClipStrength: 1, comfyLora2: 'none', comfyLora2ModelStrength: 1, comfyLora2ClipStrength: 1, comfyLora3: 'none', comfyLora3ModelStrength: 1, comfyLora3ClipStrength: 1, comfyLora4: 'none', comfyLora4ModelStrength: 1, comfyLora4ClipStrength: 1 };
  for (const [k, v] of Object.entries(D)) update(k, v);
  ui.toast('已恢复默认参数（生图页参数区即时生效）');
}

onMounted(async () => {
  const ok = await window.WB.engines.autoConnect('comfyui');
  if (ok) fullList.value = true;
});
</script>
