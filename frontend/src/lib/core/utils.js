// ============================================================
// AI图片工作台 - 基础工具：命名空间 / MD5 / toast / 确认框 / 下载 / 通用
// ============================================================
'use strict';

// 全局命名空间（非模块化，script 标签按序加载）
window.WB = window.WB || {};

WB.util = (function () {

  // ---------- MD5（内置纯 JS 实现，替代 CryptoJS） ----------
  // 基于经典 RFC 1321 实现改写
  function md5(str) {
    function rl(v, s) { return (v << s) | (v >>> (32 - s)); }
    function add(a, b) { return (((a >> 16) + (b >> 16) + (((a & 0xffff) + (b & 0xffff)) >> 16)) << 16) | (((a & 0xffff) + (b & 0xffff)) & 0xffff); }
    function cmn(q, a, b, x, s, t) { return add(rl(add(add(a, q), add(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }

    // UTF-8 编码
    const utf8 = unescape(encodeURIComponent(str));
    const n = utf8.length;
    const words = [];
    for (let i = 0; i < n; i++) words[i >> 2] = (words[i >> 2] || 0) | (utf8.charCodeAt(i) << ((i % 4) * 8));
    words[n >> 2] = (words[n >> 2] || 0) | (0x80 << ((n % 4) * 8));
    const len = (((n + 8) >> 6) + 1) * 16;
    for (let i = 0; i < len; i++) words[i] = words[i] || 0;
    words[len - 2] = n * 8;

    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < len; i += 16) {
      const [oa, ob, oc, od] = [a, b, c, d];
      a=ff(a,b,c,d,words[i],7,-680876936); d=ff(d,a,b,c,words[i+1],12,-389564586); c=ff(c,d,a,b,words[i+2],17,606105819); b=ff(b,c,d,a,words[i+3],22,-1044525330);
      a=ff(a,b,c,d,words[i+4],7,-176418897); d=ff(d,a,b,c,words[i+5],12,1200080426); c=ff(c,d,a,b,words[i+6],17,-1473231341); b=ff(b,c,d,a,words[i+7],22,-45705983);
      a=ff(a,b,c,d,words[i+8],7,1770035416); d=ff(d,a,b,c,words[i+9],12,-1958414417); c=ff(c,d,a,b,words[i+10],17,-42063); b=ff(b,c,d,a,words[i+11],22,-1990404162);
      a=ff(a,b,c,d,words[i+12],7,1804603682); d=ff(d,a,b,c,words[i+13],12,-40341101); c=ff(c,d,a,b,words[i+14],17,-1502002290); b=ff(b,c,d,a,words[i+15],22,1236535329);
      a=gg(a,b,c,d,words[i+1],5,-165796510); d=gg(d,a,b,c,words[i+6],9,-1069501632); c=gg(c,d,a,b,words[i+11],14,643717713); b=gg(b,c,d,a,words[i],20,-373897302);
      a=gg(a,b,c,d,words[i+5],5,-701558691); d=gg(d,a,b,c,words[i+10],9,38016083); c=gg(c,d,a,b,words[i+15],14,-660478335); b=gg(b,c,d,a,words[i+4],20,-405537848);
      a=gg(a,b,c,d,words[i+9],5,568446438); d=gg(d,a,b,c,words[i+14],9,-1019803690); c=gg(c,d,a,b,words[i+3],14,-187363961); b=gg(b,c,d,a,words[i+8],20,1163531501);
      a=gg(a,b,c,d,words[i+13],5,-1444681467); d=gg(d,a,b,c,words[i+2],9,-51403784); c=gg(c,d,a,b,words[i+7],14,1735328473); b=gg(b,c,d,a,words[i+12],20,-1926607734);
      a=hh(a,b,c,d,words[i+5],4,-378558); d=hh(d,a,b,c,words[i+8],11,-2022574463); c=hh(c,d,a,b,words[i+11],16,1839030562); b=hh(b,c,d,a,words[i+14],23,-35309556);
      a=hh(a,b,c,d,words[i+1],4,-1530992060); d=hh(d,a,b,c,words[i+4],11,1272893353); c=hh(c,d,a,b,words[i+7],16,-155497632); b=hh(b,c,d,a,words[i+10],23,-1094730640);
      a=hh(a,b,c,d,words[i+13],4,681279174); d=hh(d,a,b,c,words[i],11,-358537222); c=hh(c,d,a,b,words[i+3],16,-722521979); b=hh(b,c,d,a,words[i+6],23,76029189);
      a=hh(a,b,c,d,words[i+9],4,-640364487); d=hh(d,a,b,c,words[i+12],11,-421815835); c=hh(c,d,a,b,words[i+15],16,530742520); b=hh(b,c,d,a,words[i+2],23,-995338651);
      a=ii(a,b,c,d,words[i],6,-198630844); d=ii(d,a,b,c,words[i+7],10,1126891415); c=ii(c,d,a,b,words[i+14],15,-1416354905); b=ii(b,c,d,a,words[i+5],21,-57434055);
      a=ii(a,b,c,d,words[i+12],6,1700485571); d=ii(d,a,b,c,words[i+3],10,-1894986606); c=ii(c,d,a,b,words[i+10],15,-1051523); b=ii(b,c,d,a,words[i+1],21,-2054922799);
      a=ii(a,b,c,d,words[i+8],6,1873313359); d=ii(d,a,b,c,words[i+15],10,-30611744); c=ii(c,d,a,b,words[i+6],15,-1560198380); b=ii(b,c,d,a,words[i+13],21,1309151649);
      a=ii(a,b,c,d,words[i+4],6,-145523070); d=ii(d,a,b,c,words[i+11],10,-1120210379); c=ii(c,d,a,b,words[i+2],15,718787259); b=ii(b,c,d,a,words[i+9],21,-343485551);
      a=add(a,oa); b=add(b,ob); c=add(c,oc); d=add(d,od);
    }
    function hex(n) { let s = ''; for (let j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8)) & 255).toString(16)).slice(-2); return s; }
    return hex(a) + hex(b) + hex(c) + hex(d);
  }

  // ---------- toast ----------
  function toast(message, type) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, type === 'error' ? 6000 : 3000);
    setTimeout(() => el.remove(), type === 'error' ? 6400 : 3400);
  }

  // ---------- 确认框 ----------
  function confirmBox(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      const inputHtml = opts.withInput
        ? `<input class="form-input" id="__modal_input" placeholder="${opts.inputPlaceholder || ''}" style="margin-top:12px">` : '';
      mask.innerHTML = `
        <div class="modal-box">
          <div class="modal-msg">${message}</div>
          ${inputHtml}
          <div class="modal-actions">
            <button class="btn" id="__modal_cancel">取消</button>
            <button class="btn btn-primary" id="__modal_ok">${opts.okText || '确定'}</button>
          </div>
        </div>`;
      document.body.appendChild(mask);
      const close = (val) => { mask.remove(); resolve(val); };
      mask.querySelector('#__modal_cancel').onclick = () => close(null);
      mask.querySelector('#__modal_ok').onclick = () => close(opts.withInput ? mask.querySelector('#__modal_input').value : true);
      mask.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
    });
  }

  function promptBox(message, defaultValue, placeholder) {
    return confirmBox(message, { withInput: true, inputPlaceholder: placeholder || '' })
      .then(v => v === null ? null : (v || defaultValue || ''));
  }

  // ---------- 下载 ----------
  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename || 'image.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function downloadUrl(url, filename) {
    downloadDataUrl(url, filename);
  }

  // ---------- 其它 ----------
  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function randomSeed() { return Math.floor(Math.random() * 4294967295); }
  function now() { return Date.now(); }

  function displayModelName(name) {
    // 显示完整路径（含子目录），斜杠统一为正斜杠；根目录文件则直接显示文件名
    if (!name) return name;
    return String(name).replace(/\\/g, '/');
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // dataURL → Image 尺寸
  function imageSize(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // URL 图片 → dataURL（经服务端代理避免 CORS）
  async function urlToDataUrl(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const blob = await r.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch (e) {
      // 降级走服务端代理
      const r = await WB.http.request({ method: 'GET', url, responseType: 'binary' });
      const mime = r.contentType || 'image/png';
      return 'data:' + mime + ';base64,' + r.base64;
    }
  }

  // ============================================================
  // 通用蒙版包装（方式二）：裁剪 → 编辑 → 贴回
  // 使任意编辑工作流支持"局部编辑"：把底图按蒙版区域裁剪放大后作为输入图送模型，
  // 生成后再把结果按（羽化的）蒙版贴回原图 —— 不依赖模型自身 inpaint 能力与第三方节点。
  // 蒙版为遮罩编辑器导出格式：alpha 透明（0）＝要重绘。
  // ============================================================
  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  }

  // 在缩略分辨率下扫描蒙版（性能友好），返回"要重绘区域"包围盒（原图坐标）；无内容返回 null
  function maskBBoxFast(maskImg, baseW, baseH) {
    const th = 8;                                   // 忽略抗锯齿/羽化边缘的极小值
    const k = Math.min(1, 512 / Math.max(baseW, baseH));
    const sw = Math.max(1, Math.round(baseW * k));
    const sh = Math.max(1, Math.round(baseH * k));
    const c = document.createElement('canvas');
    c.width = sw; c.height = sh;
    const ctx = c.getContext('2d');
    ctx.drawImage(maskImg, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    let minX = sw, minY = sh, maxX = -1, maxY = -1;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        const a = d[(row + x) * 4 + 3];
        if (a < 255 - th) {                         // alpha 透明＝要重绘
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const s = 1 / k;
    return { x: minX * s, y: minY * s, w: (maxX - minX + 1) * s, h: (maxY - minY + 1) * s };
  }

  // 裁剪底图与蒙版（按上下文扩展比例 + 目标分辨率），返回 { image, mask, baseUrl, stitch }
  async function cropForInpaint(opts) {
    const baseImg = await loadImageEl(opts.baseUrl);
    let maskImg = await loadImageEl(opts.maskUrl);
    const W = baseImg.naturalWidth, H = baseImg.naturalHeight;
    if (maskImg.naturalWidth !== W || maskImg.naturalHeight !== H) {
      // 防御：蒙版与底图尺寸不一致时先归一，保证裁剪/贴回坐标一致
      const mc = document.createElement('canvas');
      mc.width = W; mc.height = H;
      mc.getContext('2d').drawImage(maskImg, 0, 0, W, H);
      maskImg = await loadImageEl(mc.toDataURL('image/png'));
    }
    const bbox = maskBBoxFast(maskImg, W, H);
    if (!bbox) return null;                         // 蒙版无有效内容 → 不做包装
    const f = Math.max(1, Math.min(3, Number(opts.contextFactor) || 1.5));
    const cx = bbox.x + bbox.w / 2, cy = bbox.y + bbox.h / 2;
    let cw = Math.min(W, Math.max(64, bbox.w * f));
    let ch = Math.min(H, Math.max(64, bbox.h * f));
    const x = Math.max(0, Math.min(W - cw, Math.round(cx - cw / 2)));
    const y = Math.max(0, Math.min(H - ch, Math.round(cy - ch / 2)));
    cw = Math.round(cw); ch = Math.round(ch);
    // 缩放到目标分辨率（长边＝target），尺寸对齐到 8 的倍数（对多数模型更友好）
    const target = Math.max(256, Math.min(4096, Number(opts.targetSize) || 768));
    const k = target / Math.max(cw, ch);
    const align8 = (v) => Math.max(64, Math.round(v / 8) * 8);
    const tw = align8(cw * k), th = align8(ch * k);
    const draw = (src) => {
      const c = document.createElement('canvas');
      c.width = tw; c.height = th;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, x, y, cw, ch, 0, 0, tw, th);
      return c.toDataURL('image/png');
    };
    return {
      image: draw(baseImg),
      mask: draw(maskImg),
      baseUrl: opts.baseUrl,
      stitch: { x, y, w: cw, h: ch }
    };
  }

  // 把编辑结果贴回原图：结果缩放到裁剪区尺寸 → 套用（羽化的）重绘区遮罩 → 合成到原图
  // 约定：蒙版"白=重绘区、黑=保留区"（与 cropForInpaint 的 bbox 取白区一致）
  async function stitchBack(resultUrl, pack) {
    const resImg = await loadImageEl(resultUrl);
    const maskImg = await loadImageEl(pack.mask);
    const baseImg = await loadImageEl(pack.baseUrl);
    const { x, y, w, h } = pack.stitch;
    // 1) 对蒙版边缘做模糊，作为"重绘区"羽化遮罩（白=保留结果、黑=保留原图）
    const blurMask = document.createElement('canvas');
    blurMask.width = w; blurMask.height = h;
    const bctx = blurMask.getContext('2d');
    bctx.filter = 'blur(4px)';
    bctx.drawImage(maskImg, 0, 0, w, h);
    bctx.filter = 'none';
    // 2) 编辑结果缩放到裁剪区尺寸，套用重绘区遮罩：仅在白区保留生成结果
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(resImg, 0, 0, w, h);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(blurMask, 0, 0);
    // 3) 贴回原图（保留区仍显示原图，重绘区显示生成结果）
    const out = document.createElement('canvas');
    out.width = baseImg.naturalWidth;
    out.height = baseImg.naturalHeight;
    const octx = out.getContext('2d');
    octx.drawImage(baseImg, 0, 0);
    octx.drawImage(tmp, x, y);
    return out.toDataURL('image/png');
  }

  // 首帧免过渡：把节点插入 DOM 的瞬间不播放 CSS 过渡，避免「刷新后开关从默认位滑到目标位」。
  // 做法：插入前给带过渡的元素挂 .no-anim（见 components.css / settings.css），
  // 插入并强制一次重排让最终样式生效，再于下一帧移除 .no-anim —— 此后用户交互仍有正常过渡。
  // 适用对象：toggle / 滑块等用 transition 表达状态差异的元素。
  function keepSwitchInstant(root) {
    if (!root) return;
    const sel = '.toggle, .gen-toggle .toggle';
    const commit = () => {
      // 强制重排，把「带最终状态且不过渡」的样式固化下来
      void root.offsetHeight;
      requestAnimationFrame(() => {
        root.querySelectorAll(sel).forEach((el) => el.classList.remove('no-anim'));
      });
    };
    root.querySelectorAll(sel).forEach((el) => el.classList.add('no-anim'));
    commit();
  }

  return {
    md5, toast, confirmBox, promptBox,
    downloadDataUrl, downloadUrl,
    escapeRegExp, sleep, randomSeed, now,
    displayModelName, fmtTime, imageSize, fileToDataUrl, urlToDataUrl,
    loadImageEl,
    cropForInpaint, stitchBack, keepSwitchInstant
  };
})();
