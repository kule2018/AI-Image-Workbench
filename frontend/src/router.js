import { createRouter, createWebHashHistory } from 'vue-router';

import GenerateView from './views/GenerateView.vue';
import Canvas from './views/Canvas.vue';
import Assets from './views/Assets.vue';
import Characters from './views/Characters.vue';
import BasicSettings from './views/BasicSettings.vue';
import ComfyuiSettings from './views/ComfyuiSettings.vue';
import SdSettings from './views/SdSettings.vue';
import ApiSettings from './views/ApiSettings.vue';
import About from './views/About.vue';

const routes = [
  { path: '/', redirect: '/comfyui' },
  { path: '/comfyui', component: GenerateView, meta: { nav: 'comfyui', engine: 'comfyui' } },
  { path: '/sd', component: GenerateView, meta: { nav: 'sd', engine: 'sd' } },
  { path: '/api', component: GenerateView, meta: { nav: 'api', engine: 'api' } },
  { path: '/canvas', component: Canvas, meta: { nav: 'canvas' } },
  { path: '/assets', component: Assets, meta: { nav: 'assets' } },
  { path: '/characters', component: Characters, meta: { nav: 'characters' } },
  { path: '/basic-settings', component: BasicSettings, meta: { nav: 'basic-settings' } },
  { path: '/comfyui-settings', component: ComfyuiSettings, meta: { nav: 'comfyui-settings' } },
  { path: '/sd-settings', component: SdSettings, meta: { nav: 'sd-settings' } },
  { path: '/api-settings', component: ApiSettings, meta: { nav: 'api-settings' } },
  { path: '/about', component: About, meta: { nav: 'about' } },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
