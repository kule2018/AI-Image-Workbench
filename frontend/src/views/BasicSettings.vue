<template>
  <div class="workspace">
    <div class="settings-page single">
      <!-- 通用设置 -->
      <section class="section">
        <div class="section-title">通用设置</div>
        <div class="general-row">
          <div class="field gr-field">
            <label class="form-label">缓存有效期</label>
            <select class="form-select" :value="settings.cacheDays" @change="update('cacheDays', $event.target.value)">
              <option v-for="[v, t] in cacheOptions" :key="v" :value="v" :selected="String(settings.cacheDays) === v">{{ t }}</option>
            </select>
          </div>
          <div class="gr-toggles">
            <span class="gen-toggle" v-for="tg in toggles" :key="tg.key">
              <span class="gt-label">{{ tg.label }}</span>
              <button class="toggle" :class="{ on: !!settings[tg.key] }" @click="toggle(tg.key)"></button>
            </span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-title">{{ cfg.rewrite.title }}</div>
        <gen-section :kind="'rewrite'" />
      </section>

      <section class="section">
        <div class="section-title">{{ cfg.caption.title }}</div>
        <gen-section :kind="'caption'" />
      </section>

      <!-- 提示词预设 -->
      <section class="section">
        <div class="section-title">正面/负面提示词预设</div>
        <preset-editor kind="prompt" />
      </section>

      <section class="section">
        <div class="section-title">风格提示词预设</div>
        <preset-editor kind="style" />
      </section>

      <!-- 全量数据 -->
      <section class="section">
        <div class="section-title">全量数据（备份/恢复）</div>
        <p class="hint">备份 zip 与文生图工具插件的「全量导出」格式互通，并额外包含画布与上传素材；可直接导入插件备份包，缓存图片归入素材库「导入缓存」分组。</p>
        <div class="preset-actions">
          <button class="btn btn-sm btn-primary" @click="exportZip">📦 数据导出（zip）</button>
          <button class="btn btn-sm" @click="importZip">📥 数据导入（zip）</button>
          <button class="btn btn-sm btn-danger" @click="clearAll">🗑 数据清空</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useUi } from '../composables/useUi';
import GenSection from '../components/GenSection.vue';
import PresetEditor from '../components/PresetEditor.vue';

const { settings, update, toggle } = useSettings();
const ui = useUi();

const cacheOptions = [
  ['0', '不缓存（永久保留历史）'], ['1', '一天'], ['7', '一星期'],
  ['30', '一个月'], ['365', '一年'],
];
const toggles = [
  { key: 'soundEnabled', label: '生图成功音效' },
  { key: 'autoDownload', label: '生图自动下载' },
  { key: 'cacheHit', label: '生图缓存命中' },
  { key: 'compareOn', label: '图像对比' },
  { key: 'samplePreview', label: '采样预览' },
];

const cfg = {
  rewrite: { title: '提示词优化' },
  caption: { title: '图片反推' },
};

async function exportZip() {
  await window.WB.api.exportAll();
}

async function importZip() {
  ui.pickFile('.zip,application/zip', async (f) => {
    if (!(await ui.confirm('⚠️ 导入备份包将合并其中的设置与预设，缓存图片归入「导入缓存」分组。\n继续？'))) return;
    try {
      const result = await window.WB.api.importAllZip(f);
      if (result.settings && Object.keys(result.settings).length) {
        await window.WB.settings.applyImportedSettings(result.settings);
      }
      for (const img of (result.importedImages || [])) {
        await window.WB.history.add({ engine: 'imported', prompt: img.prompt || '', model: '插件缓存导入', params: {}, images: [img.url] });
      }
      ui.toast(`导入完成：设置已合并，缓存图片 ${result.importedImages?.length || 0} 张，画布 ${result.canvasCount} 个，素材 ${result.libCount} 个。页面即将刷新`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      ui.toast('导入失败：' + e.message + '\n原数据未修改', 'error');
    }
  });
}

async function clearAll() {
  const v = await ui.confirm('此操作将清空所有设置与预设数据（不影响 output/ 图片文件）。\n确认请输入 RESET：', { withInput: true });
  if (v === null) return;
  if (v !== 'RESET') { ui.toast('输入不匹配，已取消', 'error'); return; }
  await window.WB.api.settingsSave(window.WB.settings.defaultSettings);
  location.reload();
}
</script>
