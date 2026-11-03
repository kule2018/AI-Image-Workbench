import { reactive, ref } from 'vue';

// 把 WB.settings 的运行期对象包装为响应式。
// 注意：逻辑层（core/engines/presets）会直接修改原始对象 WB.settings.S，
// 不会触发 Vue 的写入陷阱。因此注册 WB.settings.onChange（set/save 时触发），
// 在回调里把原始设置整体同步进响应式代理，确保 UI 刷新。
let _S = null;
let _tick = null;

export function useSettings() {
  if (!_S) {
    _S = reactive(window.WB.settings.all());
    _tick = ref(0);
    window.WB.settings.onChange(() => sync());
  }
  const settings = _S;

  function sync() {
    Object.assign(_S, window.WB.settings.all());
    _tick.value++;
  }

  function update(key, val) {
    settings[key] = val;
    window.WB.settings.save(key); // 触发 onChange -> sync
  }

  function toggle(key) {
    settings[key] = !settings[key];
    window.WB.settings.save(key);
  }

  // 批量更新并落盘（用于预设对象整体替换等场景）
  function saveKeys(keys) {
    window.WB.settings.save(keys);
  }

  // 逻辑层在代理之外修改设置后（如个别未触发 onChange 的预设操作），手动同步一次
  function refresh() {
    sync();
  }

  return { settings, update, toggle, saveKeys, refresh, tick: _tick };
}
