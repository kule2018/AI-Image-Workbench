<template>
  <div class="shell" :class="{ collapsed: collapsed }">
    <aside class="sidebar" id="sidebar">
      <div class="logo-row">
        <div class="logo">
          <div class="logo-icon">画</div>
          <div class="logo-text">AI图片工作台</div>
        </div>
        <button class="collapse-btn" @click="toggleCollapse" title="收起/展开导航">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path :d="collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'" />
          </svg>
        </button>
      </div>

      <div class="nav-scroll">
        <div class="nav-section-label">生图</div>
        <router-link
          v-for="item in topItems"
          :key="item.id"
          :to="item.path"
          class="nav-item"
          :title="item.title"
          active-class="active"
        >
          <span class="nav-icon" v-html="item.icon"></span>
          <span class="nav-text">{{ item.title }}</span>
        </router-link>

        <div class="nav-sep"></div>
        <div class="nav-section-label">设置</div>
        <router-link
          v-for="item in bottomItems"
          :key="item.id"
          :to="item.path"
          class="nav-item"
          :title="item.title"
          active-class="active"
        >
          <span class="nav-icon" v-html="item.icon"></span>
          <span class="nav-text">{{ item.title }}</span>
        </router-link>
      </div>

      <button class="nav-item" @click="toggleTheme" :title="isDark ? '白天模式' : '黑夜模式'">
        <span class="nav-icon" v-html="isDark ? sunIcon : moonIcon"></span>
        <span class="nav-text">{{ isDark ? '白天模式' : '黑夜模式' }}</span>
      </button>
    </aside>

    <div class="main">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { navItems } from './nav';
import { useSettings } from './composables/useSettings';

const { settings } = useSettings();

const topItems = navItems.filter((i) => i.group === 'top');
const bottomItems = navItems.filter((i) => i.group === 'bottom');

const collapsed = ref(localStorage.getItem('sb_collapsed') === '1');
const isDark = ref(settings.theme === 'dark');

const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

function toggleCollapse() {
  collapsed.value = !collapsed.value;
  localStorage.setItem('sb_collapsed', collapsed.value ? '1' : '0');
}

function toggleTheme() {
  isDark.value = !isDark.value;
  settings.theme = isDark.value ? 'dark' : 'light';
  window.WB.settings.set('theme', settings.theme);
}
</script>
