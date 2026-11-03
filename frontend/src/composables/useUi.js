// 原 WB.ui.common / WB.util 的 UI 辅助在 Vue 下用组合式函数封装
export function useUi() {
  const WB = window.WB;

  function toast(msg, type) { WB.util.toast(msg, type); }
  function confirm(msg, opts) { return WB.util.confirmBox(msg, opts); }
  function prompt(msg, def, placeholder) { return WB.util.promptBox(msg, def, placeholder); }

  function pickFile(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '';
    input.onchange = () => { if (input.files && input.files[0]) cb(input.files[0]); };
    input.click();
  }

  function pickFiles(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '';
    input.multiple = true;
    input.onchange = () => { if (input.files) cb(Array.from(input.files)); };
    input.click();
  }

  function pickJsonFile(cb) {
    pickFile('.json,application/json', async (f) => {
      try {
        const text = await f.text();
        cb(JSON.parse(text), f.name, text);
      } catch (e) {
        WB.util.toast('JSON 解析失败：' + e.message, 'error');
      }
    });
  }

  function download(filename, text) {
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    WB.util.downloadDataUrl(dataUrl, filename);
  }

  function fileToDataUrl(file) { return WB.util.fileToDataUrl(file); }

  return { toast, confirm, prompt, pickFile, pickFiles, pickJsonFile, download, fileToDataUrl };
}
