<template>
  <div class="workspace">
    <div class="ch-page">
      <div class="ch-toolbar">
        <h3 class="ch-title">角色列表</h3>
        <button class="btn btn-primary" @click="add">➕ 新增角色</button>
      </div>
      <p class="hint" style="margin:0 0 12px">角色用于快捷填充生图页的正面/负面提示词与参考图，随设置保存到后端。</p>
      <div class="ch-grid">
        <div v-for="c in characters" :key="c.id" class="ch-card">
          <div class="ch-prev" @click="setPreview(c)">
            <img v-if="c.previewImage" :src="c.previewImage" alt="">
            <span v-else class="ch-prev-ph">点击设置预览图</span>
          </div>
          <div class="ch-info">
            <input class="form-input" :value="c.name" @change="rename(c, $event.target.value)" placeholder="角色名称" />
            <textarea class="form-textarea" rows="3" :value="c.prompt" @change="setField(c, 'prompt', $event.target.value)" placeholder="正面提示词"></textarea>
            <textarea class="form-textarea" rows="2" :value="c.negativePrompt" @change="setField(c, 'negativePrompt', $event.target.value)" placeholder="负面提示词"></textarea>
          </div>
          <div class="ch-actions">
            <button class="btn btn-sm" @click="setPreview(c)">🖼 预览图</button>
            <button class="btn btn-sm" @click="editAll(c)">✏️ 编辑</button>
            <button class="btn btn-sm btn-danger" @click="del(c)">🗑 删除</button>
          </div>
        </div>
        <div v-if="!characters.length" class="empty">暂无角色，点击「新增角色」开始</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUi } from '../composables/useUi';
import { useSettings } from '../composables/useSettings';

const { toast, confirm, prompt, pickFile, fileToDataUrl } = useUi();
const { settings, update } = useSettings();
const WB = window.WB;

const characters = ref([]);

function sync() { update('characterList', characters.value); }

onMounted(() => { characters.value = Array.isArray(settings.characterList) ? settings.characterList.slice() : []; });

async function add() {
  const name = await prompt('角色名称：', '新角色');
  if (!name) return;
  characters.value.push({ id: String(Date.now()), name, prompt: '', negativePrompt: '', previewImage: null });
  sync();
  toast('已新增角色「' + name + '」');
}
async function rename(c, v) { c.name = v; sync(); }
function setField(c, k, v) { c[k] = v; sync(); }
async function setPreview(c) {
  pickFile('image/*', async (f) => {
    c.previewImage = await fileToDataUrl(f);
    sync();
    toast('预览图已设置');
  });
}
async function editAll(c) {
  const p = await prompt('正面提示词：', c.prompt || '', '正面提示词');
  if (p === null) return;
  const n = await prompt('负面提示词：', c.negativePrompt || '', '负面提示词');
  if (n === null) return;
  c.prompt = p; c.negativePrompt = n; sync();
  toast('已更新角色「' + c.name + '」');
}
async function del(c) {
  if (!(await confirm('确定删除角色「' + c.name + '」？'))) return;
  characters.value = characters.value.filter((x) => x.id !== c.id);
  sync();
  toast('已删除');
}
</script>

<style scoped>
.ch-page { height: 100%; overflow: auto; }
.ch-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ch-title { margin: 0; font-size: 16px; }
.ch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; align-content: start; }
.ch-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.ch-prev { width: 100%; aspect-ratio: 3/4; background: var(--panel-2); border: 1px dashed var(--border); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ch-prev img { width: 100%; height: 100%; object-fit: cover; }
.ch-prev-ph { color: var(--text-2); font-size: 12px; }
.ch-info { display: flex; flex-direction: column; gap: 6px; }
.ch-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.empty { color: var(--text-2); padding: 40px; text-align: center; width: 100%; }
</style>
