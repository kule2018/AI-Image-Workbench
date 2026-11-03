<template>
  <div class="workspace">
    <div class="asset-page">
      <div class="asset-toolbar">
        <div class="seg">
          <button v-for="t in tabs" :key="t.key" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        </div>
        <button v-if="tab === 'library'" class="btn btn-primary" @click="upload">⬆ 上传素材</button>
        <span class="hint">{{ items.length }} 项</span>
      </div>
      <div class="asset-grid">
        <div v-for="it in items" :key="it.url" class="asset-card">
          <img :src="it.url" alt="" @click="open(it.url)" />
          <div class="asset-bar">
            <span class="asset-name" :title="it.name">{{ it.name }}</span>
            <button class="icon-btn" title="删除" @click="del(it)">🗑</button>
          </div>
        </div>
        <div v-if="!items.length" class="empty">暂无{{ tab === 'library' ? '素材' : (tab === 'imported' ? '导入图' : '生成图') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUi } from '../composables/useUi';

const { toast, confirm, pickFiles, fileToDataUrl } = useUi();
const WB = window.WB;

const tabs = [
  { key: 'library', label: '素材库' },
  { key: 'output', label: '生成图' },
  { key: 'imported', label: '导入图' },
];
const tab = ref('library');
const items = ref([]);

async function load() {
  const dir = tab.value === 'library' ? 'library' : 'output';
  const sub = tab.value === 'imported' ? 'imported' : '';
  const data = await WB.api.storageFiles(dir, sub);
  items.value = (data || []).map((it) => ({
    name: it.name,
    url: it.url || (tab.value === 'library'
      ? '/library/' + it.name
      : (sub ? '/output/imported/' + it.name : '/output/' + it.name)),
  }));
}

function switchTab(k) { tab.value = k; load(); }

async function upload() {
  pickFiles('image/*', async (files) => {
    for (const f of files) {
      try {
        const dataUrl = await fileToDataUrl(f);
        await WB.api.libraryUpload(dataUrl);
      } catch (e) { toast('上传失败：' + e.message, 'error'); }
    }
    toast('已上传 ' + files.length + ' 张素材');
    load();
  });
}

async function del(it) {
  if (!(await confirm('确定删除「' + it.name + '」？'))) return;
  const dir = tab.value === 'library' ? 'library' : 'output';
  const sub = tab.value === 'imported' ? 'imported' : '';
  await WB.api.storageDelete(dir, [it.name], sub);
  toast('已删除');
  load();
}

function open(url) { window.open(url, '_blank'); }

onMounted(load);
</script>

<style scoped>
.asset-page { display: flex; flex-direction: column; height: 100%; }
.asset-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.seg button { background: var(--panel); color: var(--text); border: 0; padding: 7px 16px; cursor: pointer; font-size: 13px; }
.seg button.active { background: var(--accent); color: #fff; }
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; overflow: auto; flex: 1; align-content: start; }
.asset-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.asset-card img { width: 100%; aspect-ratio: 1/1; object-fit: cover; cursor: zoom-in; background: #000; display: block; }
.asset-bar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
.asset-name { flex: 1; font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.icon-btn { border: 0; background: transparent; cursor: pointer; font-size: 13px; color: var(--text-2); }
.icon-btn:hover { color: #e06; }
.empty { color: var(--text-2); padding: 40px; text-align: center; width: 100%; }
</style>
