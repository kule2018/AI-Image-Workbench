<template>
  <div class="workspace">
    <div class="about-page" v-if="info">
      <h2>关于 AI 图片工作台</h2>
      <ul class="about-meta">
        <li><b>名称：</b>{{ info.name }}</li>
        <li><b>版本：</b>{{ info.version }}</li>
        <li><b>数据目录：</b>{{ info.dataDir }}</li>
        <li><b>输出目录：</b>{{ info.outputDir }}</li>
        <li><b>服务器时间：</b>{{ new Date(info.serverTime).toLocaleString() }}</li>
      </ul>
      <p class="hint">前端：Vue3 + Vite；后端：NestJS + TypeORM + MySQL。UI 模块正逐步以 Vue 组件重写。</p>
    </div>
    <div v-else class="page-placeholder"><p>加载中…</p></div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
const info = ref(null);
onMounted(async () => {
  try { info.value = await window.WB.api.appInfo(); } catch (e) { /* ignore */ }
});
</script>
