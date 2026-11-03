<template>
  <div class="preset-editor">
    <div class="pe-texts">
      <div class="field">
        <label class="form-label">预设选择</label>
        <select class="form-select" :value="curId" @change="onSwitch($event.target.value)">
          <option v-for="name in names" :key="name" :value="name" :selected="name === curId">{{ name }}</option>
        </select>
      </div>
      <div class="field">
        <label class="form-label">{{ isP ? '正面提示词' : '风格提示词（自动拼接在正面提示词之后）' }}</label>
        <textarea class="form-textarea" :value="fixed" @input="setFixed($event.target.value)"></textarea>
      </div>
      <div class="field" v-if="isP">
        <label class="form-label">负面提示词</label>
        <textarea class="form-textarea" :value="neg" @input="setNeg($event.target.value)"></textarea>
      </div>
    </div>
    <div class="pe-side">
      <label class="form-label">预设效果图</label>
      <div class="preview-box-34" @click="pickImg">
        <img v-if="previewSrc" :src="previewSrc" alt="">
        <div v-else class="pv-placeholder">📷<br>点击上传</div>
      </div>
      <button class="btn btn-sm" @click="delImg">🗑 删除预览图</button>
    </div>
    <div class="preset-actions cols-7">
      <button class="btn btn-sm btn-primary" @click="newPreset">➕ 新建预设</button>
      <button class="btn btn-sm btn-primary" @click="save">💾 保存预设</button>
      <button class="btn btn-sm btn-danger" @click="del">🗑️ 删除预设</button>
      <button class="btn btn-sm btn-danger" @click="delAll">🗑️ 删除全部</button>
      <button class="btn btn-sm" @click="importP">📥 导入预设</button>
      <button class="btn btn-sm" @click="exportP">📤 导出预设</button>
      <button class="btn btn-sm" @click="exportAll">📦 导出全部</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';

const props = defineProps({ kind: { type: String, required: true } });
const { settings, refresh } = useSettings();
const ui = useUi();
const isP = props.kind === 'prompt';

// prompt -> yushe/yusheid ; style -> stylePresets/stylePresetId
const objKey = isP ? 'yushe' : 'stylePresets';
const idKey = isP ? 'yusheid' : 'stylePresetId';
const refKey = props.kind + 'RefImg'; // 本地待保存图

const curId = computed(() => settings[idKey]);
const names = computed(() => Object.keys(settings[objKey] || {}));
const cur = computed(() => (settings[objKey] || {})[settings[idKey]] || {});
const fixed = computed(() => (isP ? cur.value.fixedPrompt : cur.value.stylePrompt) || '');
const neg = computed(() => cur.value.negativePrompt || '');
const previewSrc = computed(() => refImg.value !== undefined ? refImg.value : (cur.value.referenceImage || null));
const refImg = ref(undefined);

function setFixed(v) {
  if (!settings[objKey][settings[idKey]]) settings[objKey][settings[idKey]] = {};
  if (isP) settings[objKey][settings[idKey]].fixedPrompt = v;
  else settings[objKey][settings[idKey]].stylePrompt = v;
}
function setNeg(v) {
  if (!settings[objKey][settings[idKey]]) settings[objKey][settings[idKey]] = {};
  settings[objKey][settings[idKey]].negativePrompt = v;
}

function onSwitch(name) {
  if (isP) window.WB.presets.manager.switchPromptPreset(name);
  else window.WB.presets.manager.switchStylePreset(name);
  refImg.value = undefined;
  refresh();
}

async function newPreset() {
  const name = await ui.prompt('输入新' + (isP ? '' : '风格') + '预设名称：');
  if (!name) return;
  if (isP) window.WB.presets.manager.savePromptPreset(name, '', '', null);
  else window.WB.presets.manager.saveStylePreset(name, '', null);
  refImg.value = undefined;
  refresh();
}
function save() {
  const name = settings[idKey];
  if (isP) window.WB.presets.manager.savePromptPreset(name, settings[objKey][name]?.fixedPrompt || '', settings[objKey][name]?.negativePrompt || '', refImg.value);
  else window.WB.presets.manager.saveStylePreset(name, settings[objKey][name]?.stylePrompt || '', refImg.value);
  refImg.value = undefined;
  refresh();
}
async function del() {
  if (isP) await window.WB.presets.manager.deletePromptPreset(settings[idKey]);
  else await window.WB.presets.manager.deleteStylePreset(settings[idKey]);
  refImg.value = undefined;
  refresh();
}
async function delAll() {
  if (!(await ui.confirm('确定删除全部预设？（保留当前选择）'))) return;
  const keep = settings[idKey];
  if (isP) {
    settings.yushe = { [keep]: settings.yushe[keep] || { fixedPrompt: '', negativePrompt: '', referenceImage: null } };
    window.WB.settings.save('yushe');
  } else {
    settings.stylePresets = { [keep]: settings.stylePresets[keep] || { stylePrompt: '', referenceImage: null } };
    window.WB.settings.save('stylePresets');
  }
  refImg.value = undefined;
}
function importP() {
  ui.pickJsonFile((data) => {
    const r = isP ? window.WB.presets.manager.importPromptPresets(data) : window.WB.presets.manager.importStylePresets(data);
    ui.toast(`已导入 ${r.count} 个预设` + (r.last ? `，当前「${r.last}」` : ''));
    refImg.value = undefined;
    refresh();
  });
}
function exportP() {
  const json = isP ? window.WB.presets.manager.exportPromptPreset(curId.value) : window.WB.presets.manager.exportStylePreset(curId.value);
  ui.download((isP ? 'preset_' : 'style_preset_') + curId.value + '.json', json);
}
function exportAll() {
  const json = isP ? window.WB.presets.manager.exportAllPromptPresets() : window.WB.presets.manager.exportAllStylePresets();
  ui.download(isP ? 'all_presets.json' : 'all_style_presets.json', json);
}
function delImg() {
  const p = (settings[objKey] || {})[settings[idKey]];
  if (p) { p.referenceImage = null; window.WB.settings.save(objKey); }
  refImg.value = null;
  ui.toast('已删除' + (isP ? '' : '风格') + '预设效果图');
}
async function pickImg() {
  ui.pickFile('image/*', async (f) => {
    refImg.value = await ui.fileToDataUrl(f);
    ui.toast('效果图已选择，点击「保存预设」后写入当前预设');
  });
}
</script>
