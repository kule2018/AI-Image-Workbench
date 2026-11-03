<template>
  <div class="workspace">
    <div class="settings-page two-col">
      <div class="col-left">
        <section class="section">
          <div class="section-title">连接设置</div>
          <div class="field-row">
            <div class="field" style="flex:1;min-width:0">
              <label class="form-label">SD WebUI API地址</label>
              <input type="text" class="form-input" v-model="urlInput" placeholder="http://localhost:7860" @change="update('sdUrl', urlInput)">
            </div>
            <div class="field" style="flex:1;min-width:0">
              <label class="form-label">模型选择 (Checkpoint)
                <span class="badge" :class="settings.sdConnected ? 'ok' : 'bad'">{{ settings.sdConnected ? '已连接' : '未连接' }}</span>
              </label>
              <div class="field-row">
                <select class="form-select" style="flex:1;min-width:0" :value="settings.sdModel" @change="update('sdModel', $event.target.value)">
                  <option v-if="!fullList && settings.sdModel" :value="settings.sdModel" selected>{{ displayName(settings.sdModel) }}</option>
                  <option v-if="!fullList && !settings.sdModel" value="">点击连接获取模型列表</option>
                  <option v-for="m in settings.sdModelList" :key="m" :value="m" :selected="m === settings.sdModel">{{ displayName(m) }}</option>
                </select>
                <button class="btn btn-sm btn-primary" @click="doConnect(false)" style="white-space:nowrap">连接</button>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">生成参数</div>
          <div class="form-grid-3">
            <div class="field"><label class="form-label">宽度</label><input class="form-input" :value="settings.sdWidth" @change="update('sdWidth', $event.target.value)"></div>
            <div class="field"><label class="form-label">高度</label><input class="form-input" :value="settings.sdHeight" @change="update('sdHeight', $event.target.value)"></div>
            <div class="field"><label class="form-label">步数</label><input class="form-input" :value="settings.sdSteps" @change="update('sdSteps', $event.target.value)"></div>
            <div class="field"><label class="form-label">CFG Scale</label><input class="form-input" :value="settings.sdCfgScale" @change="update('sdCfgScale', $event.target.value)"></div>
            <div class="field"><label class="form-label">种子</label><input class="form-input" :value="settings.sdSeed" @change="update('sdSeed', $event.target.value)"></div>
            <div class="field"><label class="form-label">采样器</label>
              <select class="form-select" :value="settings.sdSamplerName" @change="update('sdSamplerName', $event.target.value)">
                <option v-for="s in samplerOptions" :key="s" :value="s" :selected="s === settings.sdSamplerName">{{ s }}</option>
              </select></div>
            <div class="field"><label class="form-label">调度器</label>
              <select class="form-select" :value="settings.sdScheduler" @change="update('sdScheduler', $event.target.value)">
                <option v-for="s in schedulerOptions" :key="s" :value="s" :selected="s === settings.sdScheduler">{{ s }}</option>
              </select></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">LoRA 模型 (可选1-4个)</div>
          <div class="lora-row" v-for="n in [1,2,3,4]" :key="n">
            <select class="form-select" style="flex:1" :value="settings['sdLora'+n]" @change="update('sdLora'+n, $event.target.value)">
              <option value="none" :selected="settings['sdLora'+n] === 'none'">none</option>
              <option v-for="m in settings.sdLoraList" :key="m" :value="m" :selected="m === settings['sdLora'+n]">{{ displayName(m) }}</option>
            </select>
            <label class="lora-str">模型<input class="form-input" style="width:64px" type="number" step="0.01" :value="settings['sdLora'+n+'ModelStrength']" @change="update('sdLora'+n+'ModelStrength', +$event.target.value)"></label>
            <label class="lora-str">CLIP<input class="form-input" style="width:64px" type="number" step="0.01" :value="settings['sdLora'+n+'ClipStrength']" @change="update('sdLora'+n+'ClipStrength', +$event.target.value)"></label>
          </div>
          <div class="reset-row"><button class="btn btn-sm" @click="resetDefaults">🔄 重设默认值</button></div>
        </section>
      </div>
      <div class="col-right"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';

const { settings, update } = useSettings();
const ui = useUi();
const fullList = ref(false);
const urlInput = ref(settings.sdUrl);
const displayName = (m) => window.WB.util.displayModelName(m || '');
const samplerOptions = ['DPM++ 2M', 'DPM++ 2M Karras', 'DPM++ SDE', 'Euler', 'Euler a', 'DDIM', 'LMS', 'Heun'];
const schedulerOptions = ['Karras', 'Exponential', 'Normal', 'Simple', 'DDIM Uniform'];

async function doConnect(silent) {
  try {
    update('sdUrl', urlInput.value);
    await window.WB.engines.registry.sd.connect(true);
    fullList.value = true;
    if (!silent) ui.toast('SD WebUI 连接成功，已刷新模型/采样器/LoRA 列表');
  } catch (e) {
    window.WB.settings.set('sdConnected', false);
    if (!silent) ui.toast('SD WebUI 连接失败：' + e.message + '\n请确认已加 --api 参数启动', 'error');
  }
}
async function resetDefaults() {
  if (!(await ui.confirm('确定将 SD 生成参数恢复为默认值？（连接设置不会被重置）'))) return;
  const D = { sdWidth: '1216', sdHeight: '832', sdSteps: '20', sdCfgScale: '7', sdSeed: '-1', sdSamplerName: 'DPM++ 2M', sdScheduler: 'Karras', sdLora1: 'none', sdLora1ModelStrength: 1, sdLora1ClipStrength: 1, sdLora2: 'none', sdLora2ModelStrength: 1, sdLora2ClipStrength: 1, sdLora3: 'none', sdLora3ModelStrength: 1, sdLora3ClipStrength: 1, sdLora4: 'none', sdLora4ModelStrength: 1, sdLora4ClipStrength: 1 };
  for (const [k, v] of Object.entries(D)) update(k, v);
  ui.toast('已恢复默认参数（生图页参数区即时生效）');
}

onMounted(async () => {
  const ok = await window.WB.engines.autoConnect('sd');
  if (ok) fullList.value = true;
});
</script>
