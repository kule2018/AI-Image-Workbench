<template>
  <div class="gen-box" :data-gen="kind">
    <div class="field-row gen-row">
      <div class="field" style="flex:0 0 132px">
        <label class="form-label">{{ cfg.title }}引擎</label>
        <select class="form-select" :value="settings[cfg.engineKey]" @change="update(cfg.engineKey, $event.target.value)">
          <option value="comfyui" :selected="settings[cfg.engineKey] !== 'off'">ComfyUI</option>
          <option value="off" :selected="settings[cfg.engineKey] === 'off'">关闭</option>
        </select>
      </div>
      <div class="field" style="flex:1 1 auto;min-width:140px">
        <label class="form-label">{{ cfg.modelLabel }}</label>
        <select class="form-select" :value="modelVal" @change="onModelChange">
          <option v-if="!probeOk" value="">{{ probeMsg || '正在读取 ComfyUI 模型…' }}</option>
          <template v-for="t in templates" :key="t.id">
            <optgroup :label="t.label">
              <option v-for="m in t.models" :key="t.id + '::' + m.value" :value="t.id + '::' + m.value">{{ m.label }}</option>
            </optgroup>
          </template>
          <option v-if="modelVal && !modelInList" :value="modelVal" disabled>未检测到对应模型「{{ curModelLabel }}」</option>
        </select>
      </div>
      <div class="field" style="flex:0 0 176px">
        <label class="form-label">CLIP 类型</label>
        <select class="form-select" :value="settings[cfg.clipTypeKey]" @change="update(cfg.clipTypeKey, $event.target.value)">
          <option v-if="!clipOptions.length" value="">未连接 ComfyUI</option>
          <option v-for="o in clipOptions" :key="o" :value="o" :selected="settings[cfg.clipTypeKey] === o">{{ o }}</option>
        </select>
      </div>
      <div class="field" style="flex:0 0 104px">
        <label class="form-label">写入方式</label>
        <select class="form-select" :value="writeMode" @change="update(cfg.writeModeKey, $event.target.value)">
          <option value="append" :selected="writeMode !== 'replace'">追加</option>
          <option value="replace" :selected="writeMode === 'replace'">替换</option>
        </select>
      </div>
    </div>
    <div class="field" style="margin-top:8px">
      <label class="form-label">{{ cfg.promptLabel }}</label>
      <textarea class="form-textarea" rows="3" :value="settings[cfg.promptKey]" @change="update(cfg.promptKey, $event.target.value)"></textarea>
    </div>
    <p class="hint" style="margin:6px 0 0">{{ statusText }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSettings } from '../composables/useSettings';

const props = defineProps({ kind: { type: String, required: true } });
const { settings, update } = useSettings();

const CFG = {
  rewrite: {
    title: '提示词优化', modelLabel: '优化模型', promptLabel: '优化指令',
    engineKey: 'rewriteEngine', modelKey: 'rewriteModel', templateKey: 'rewriteTemplate',
    clipTypeKey: 'rewriteClipType', writeModeKey: 'rewriteWriteMode', promptKey: 'rewritePrompt',
    writeDefault: 'replace',
  },
  caption: {
    title: '图片反推', modelLabel: '反推模型', promptLabel: '反推指令',
    engineKey: 'captionEngine', modelKey: 'captionModel', templateKey: 'captionTemplate',
    clipTypeKey: 'captionClipType', writeModeKey: 'captionWriteMode', promptKey: 'captionPrompt',
    writeDefault: 'append',
  },
};
const cfg = CFG[props.kind];

const templates = ref([]);
const probeOk = ref(false);
const probeMsg = ref('');
const statusText = ref('');

const writeMode = computed(() => String(settings[cfg.writeModeKey] || cfg.writeDefault));
const modelVal = computed(() => {
  const t = settings[cfg.templateKey];
  const m = settings[cfg.modelKey];
  return t && m ? t + '::' + m : '';
});
const curModelLabel = computed(() => settings[cfg.modelKey] || '');
const modelInList = computed(() => {
  const v = settings[cfg.modelKey];
  if (!v) return true;
  return templates.value.some(t => t.id === settings[cfg.templateKey] && t.models.some(m => m.value === v));
});

const clipOptions = computed(() => {
  const set = new Set();
  for (const t of templates.value) {
    const f = (t.fields || []).find(x => x.key === 'captionClipType');
    if (f && f.options) f.options.forEach(o => set.add(o));
  }
  return Array.from(set);
});

function onModelChange(e) {
  const val = e.target.value;
  const i = String(val).indexOf('::');
  if (i < 0) return;
  update(cfg.templateKey, val.slice(0, i));
  update(cfg.modelKey, val.slice(i + 2));
}

onMounted(async () => {
  if (!window.WB.caption) { probeMsg.value = '反推模块未加载'; return; }
  try {
    const res = await window.WB.caption.probe(true);
    if (!res || !res.ok) {
      probeMsg.value = res?.message || '未读取 ComfyUI 模型';
      statusText.value = probeMsg.value;
      return;
    }
    templates.value = res.templates || [];
    probeOk.value = true;
    const count = templates.value.reduce((n, t) => n + (t.models ? t.models.length : 0), 0);
    statusText.value = `已从 ComfyUI 读取 ${templates.value.length} 类文本生成节点、共 ${count} 个模型（清单不落盘，随 ComfyUI 实时变化）`;
  } catch (e) {
    probeMsg.value = e.message;
    statusText.value = e.message;
  }
});
</script>
