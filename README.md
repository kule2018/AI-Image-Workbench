# AI 图片工作台（AI Image Workbench）

一个**本地/内网自托管**的 AI 绘图工作台：把 ComfyUI、Stable Diffusion WebUI、云端生图 API 三类引擎收进同一个界面，统一提示词预设、历史记录、素材库与无限画布。

> 前身是一个跑在浏览器插件里的「文生图工具 2.0」。改造为 Web 服务时，**设置键名、备份包格式、工作流模板的占位符体系全部沿用插件命名**，因此本文档中会出现 `yushe`、`otherApi*`、`comfyLora1~4` 这类非直觉的字段名——它们是为了兼容旧备份而刻意保留的。

- 版本：`/api/app-info` 返回 `1.5.0`（`package.json` 仍是 `1.0.0`，不一致，见「已知问题」）
- 形态：单用户，无登录、无多租户
- 许可：MIT

---

## 1. 功能总览

| 模块 | 路由 | 能力 |
| --- | --- | --- |
| ComfyUI 生图 | `/comfyui` | 工作流模板驱动；模型/LoRA/采样器选择；参考图多槽注入；局部重绘（蒙版）；采样实时预览 |
| SD WebUI 生图 | `/sd` | txt2img；4 组 LoRA 与双强度；采样器/调度器切换 |
| 云端 API 生图 | `/api` | 预设化多平台；自定义 JSON 请求体占位符；参考图；异步任务轮询 |
| 无限画布 | `/canvas` | 节点 + 连线；可视化/JSON 双模式；导出 PNG；生成结果一键送入画布 |
| 素材库 | `/assets` | 三组：素材库（上传）/ 生成图 / 导入图；可删单文件 |
| 角色列表 | `/characters` | 角色名 + 正负提示词，生成时按关键词替换进提示词 |
| 基础设置 | `/basic-settings` | 缓存有效期、音效/自动下载/缓存命中/图像对比/采样预览开关；提示词优化；图片反推；预设编辑器；全量备份 |
| 引擎设置 | `/comfyui-settings` `/sd-settings` `/api-settings` | 地址、模型列表、默认参数、工作流/API 预设管理 |
| 关于 | `/about` | 应用信息 |

三项容易被忽略但很实用的设计：

1. **生图缓存命中**：生成前按「最终提示词」在历史里查，命中则直接返回旧图（`cacheHit` 默认关闭）。带蒙版的重绘强制跳过缓存——缓存键只有提示词，不同蒙版会误命中。
2. **提示词组装链**：`风格预设 → 提示词预设 → 角色关键词替换 → AQT 质量标签`，由 `presets/manager.buildPositive()` 统一完成，引擎拿到的已是拼装后的最终提示词。
3. **图像对比**：结果图悬停出竖线，左为参考图①、右为新图（`compareOn` 默认开启）。

---

## 2. 技术架构

```
┌──────────────────────── 浏览器 ────────────────────────┐
│  Vue 3 (SPA, hash 路由)                                │
│  views/ 组件  ──  window.WB.* 逻辑层（非响应式）        │
│                    ├ core/   api · http · settings     │
│                    ├ engines/ comfyui · sd · otherapi  │
│                    └ presets/ defaults · manager       │
└──────────────┬─────────────────────────────────────────┘
               │ /api/*  /output/*  /library/*   WS: /api/comfy-ws
┌──────────────▼─────────────────────────────────────────┐
│  NestJS 10（默认 :3000）                               │
│  settings · history · canvas · library · storage       │
│  backup（自研 ZIP） · files（静态） · proxy · comfy-ws │
└───┬───────────────┬──────────────────┬─────────────────┘
    │ MySQL         │ 本地磁盘          │ 出网
  TypeORM      data/ output/       ComfyUI :8188
  (4 张表)     (library/canvases)   SD WebUI :7860
                                    云端 API
```

**两个关键架构决策**：

- **前端所有出网请求都由后端代发**。浏览器不直连 ComfyUI / SD / 云 API，统一走 `POST /api/proxy`。目的是绕开 CORS 与混合内容限制，也让密钥留在服务端。`lib/core/http.js` 是唯一出口。
- **逻辑层不依赖框架**。`lib/` 下的模块以副作用方式挂到 `window.WB`，Vue 只负责渲染。这是从插件时代继承的结构，好处是引擎代码可直接复用，代价是状态变更不走 Vue 响应式，组件需要用 `composables/` 桥接。

### 2.1 目录结构

```
backend/
  src/
    main.ts                 入口；关闭默认 bodyParser，自挂 2100MB 上限
    app.module.ts           TypeORM + 静态托管 + 模块装配
    common/
      paths.ts              DATA_DIR / OUTPUT_DIR 解析与建目录
      utils/file.util.ts    safeName · decodeDataUrl · genImageName · readRawBody
      utils/zip.util.ts     自研 ZIP 读写（crc32 + node:zlib）
    settings/   history/   canvas/   library/     数据 CRUD
    storage/    文件列表与删除（磁盘 + DB 混合）
    files/      /output/* 与 /library/* 静态服务（含路径穿越防护）
    proxy/      出网 HTTP 代理（支持二进制 base64 透传）
    backup/     全量导出/导入 zip
    comfy-ws/   WebSocket 字节级双向管道（采样预览）
  data/  output/            运行期生成，已 gitignore

frontend/
  src/
    main.js                 boot：等设置加载 → 应用主题 → 清理历史 → mount
    router.js  nav.js       路由与侧边导航
    App.vue                 外壳（侧栏 + router-view）
    views/                  9 个页面
    components/             GenSection（反推/优化）· PresetEditor
    composables/            useSettings · useUi（Vue ↔ WB 桥）
    lib/core/               api · http · settings · history · utils · events · page-lifecycle
    lib/engines/            comfyui · sd · otherapi · caption · index（注册表）
    lib/presets/            defaults（内置模板/预设）· manager
    assets/css/             8 个样式文件，按页面切分
```

---

## 3. 快速开始

### 3.1 环境要求

- Node.js ≥ 18
- MySQL ≥ 5.7（`utf8mb4`）
- 可选：ComfyUI（:8188）、SD WebUI（:7860，需 `--api`）

### 3.2 后端

```bash
cd backend
npm install
# 建库（表由 TypeORM synchronize 自动创建）
mysql -uroot -e "CREATE DATABASE ai_image_workbench DEFAULT CHARSET utf8mb4;"
npm run start:dev        # 默认 http://localhost:3000
```

### 3.3 前端（开发）

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173，/api /output /library /api/comfy-ws 全部代理到 3000
```

### 3.4 生产部署

```bash
cd frontend && npm run build     # 产出 frontend/dist
cd ../backend && npm run build && npm run start:prod
```

后端启动时会探测 `../frontend/dist`（或 `FRONTEND_DIST`），存在则以 `ServeStaticModule` 托管，`/api`、`/output`、`/library` 除外——**单端口即可对外服务**。

### 3.5 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端监听端口 |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | MySQL 地址 |
| `DB_USER` / `DB_PASSWORD` | `root` / 空 | 账号 |
| `DB_NAME` | `ai_image_workbench` | 库名 |
| `DATA_DIR` | `<cwd>/data` | 素材库与画布落盘根目录 |
| `OUTPUT_DIR` | `<cwd>/output` | 生成图落盘目录 |
| `FRONTEND_DIST` | 自动探测 | 前端产物路径 |

> `DATA_DIR` 与 `OUTPUT_DIR` 都相对于**进程工作目录**解析，所以务必在 `backend/` 下启动，否则目录会落到别处。

---

## 4. HTTP API

所有接口无鉴权前缀（没有 `/auth`），返回体均为 JSON（标注 `zip` 的除外）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/app-info` | 名称、版本、服务器时间、目录名 |
| GET | `/api/settings` | 取整份设置对象 |
| POST | `/api/settings` | **浅合并补丁**（`Object.assign` 语义），返回 `{ok:true}` |
| GET | `/api/history?engine=&limit=` | 历史列表，`engine` 过滤、`limit` 截断；同时返回 `total` |
| POST | `/api/history` | 四选一：`{item}` 追加 / `{items:[]}` 批量前置 / `{action:'delete',timestamps:[]}` / `{action:'clear'}` |
| POST | `/api/history/save-image` | `{dataUrl}` → 落盘 `output/`，返回 `{url,file}` |
| GET | `/api/canvases` | 画布摘要列表（id/title/updated_at，按更新时间倒序） |
| POST | `/api/canvases` | 保存整张画布（`id` 必填，upsert） |
| GET | `/api/canvases/:id` | 取完整画布数据，404 = 不存在 |
| DELETE | `/api/canvases/:id` | 删除画布 |
| POST | `/api/library/upload` | `{dataUrl}` → 落盘 `data/library/` + 入库 |
| GET | `/api/storage-files?dir=&sub=` | `dir=library` 读库表；否则读磁盘（`sub=imported` 切子目录） |
| POST | `/api/storage-files/delete` | `{dir,names[],sub}` 批量删除 |
| GET | `/api/export-all` | **zip** 全量导出 |
| POST | `/api/import-all` | 导入；支持 `application/zip` 裸二进制或 `{dataUrl}` JSON |
| POST | `/api/proxy` | 出网代理，见下 |
| GET | `/output/*` `/library/*` | 静态文件，MIME 白名单，含路径穿越校验 |
| WS | `/api/comfy-ws?target=host` | ComfyUI 采样预览透传 |

### `/api/proxy` 契约

```jsonc
// 请求
{
  "url": "https://api.example.com/v1/images/generations",
  "method": "POST",
  "headers": { "Authorization": "Bearer sk-..." },
  "body": { "model": "..." },        // 对象或字符串；有值且无 Content-Type 时补 application/json
  "bodyBase64": "AAA...",            // 二进制/multipart 用，优先于 body
  "responseType": "text" | "arraybuffer"
}
// 响应
{ "status": 200, "contentType": "image/png", "binary": true, "base64": "..." }
{ "status": 200, "contentType": "application/json", "text": "..." }
```

代理会**剥离** `content-length` / `transfer-encoding` / `connection` 并按实际 body 重算长度——这是为了修一个真实故障：base64 上传时原始长度是 JSON 包长度，不重算会让上游按错误长度截断。超时 600 秒。

---

## 5. 数据模型

MySQL 4 张表，均由 TypeORM 自动同步。

| 表 | 主键 | 关键字段 | 语义 |
| --- | --- | --- | --- |
| `settings` | `id`（恒为 1） | `data JSON` | 单行存整份设置。前端按补丁合并，不做深合并 |
| `history` | 自增 `id` | `engine` `timestamp BIGINT` `data JSON` | 一条生成记录一行；图片本体在 `output/` |
| `canvas` | `id VARCHAR(160)` | `title` `updated_at BIGINT` `data JSON` | 整张画布序列化进 `data` |
| `library` | 自增 `id` | `file` `url` `name` `created_at` | 上传素材；二进制在 `data/library/` |

设计取向上，**能塞的都塞进 JSON 列**：设置、历史记录、画布结构都是自由形状，表只做索引与筛选。好处是前端字段演进不用改表，代价是无法用 SQL 做深查询，分页/过滤只能拉回内存处理（见「已知问题」）。

### 磁盘子目录

```
backend/data/
  library/      上传素材（文件名 = 时间戳_随机.扩展名）
  canvases/     预留（当前画布存 MySQL，未落盘）
backend/output/
  imported/     备份包导入的缓存图
  *.png|jpg|webp
```

---

## 6. 三大引擎

统一入口 `WB.engines.generate(task)`，签名固定：

```js
task = {
  engine: 'comfyui' | 'sd' | 'api',
  prompt, negativePrompt,
  refImages: [dataURL], refStrength, refMasks: [dataURL],
  overrides: { model, ... },   // 画布节点可逐项覆盖
  noCache: false               // 画布/脚本调用可跳过缓存
}
// → { images: [dataURL], meta: { finalPrompt, finalNegativePrompt, cached?, engine } }
```

注册表模式：`WB.engines.register(id, engine)`，引擎只需实现 `connect(silent)` 与 `generate(task)`。新增引擎不用碰 UI。

### 6.1 ComfyUI（`lib/engines/comfyui.js`，约 1130 行）

最复杂的一块。核心是**工作流模板 + 占位符替换**：

1. 选模板 → `parseWorkflow()` 剥掉 JSON 注释（模板里带大段使用说明，是合法 JSONC）；
2. `replacepro()` 替换占位符；
3. 参考图经 `POST /upload/image` 上传后把**文件名**写进 `LoadImage.image`；
4. `pruneEmptyImageSlots()` 按拓扑裁剪未被使用的参考图槽（旁路节点重接、纯转换节点删除）；
5. `processLoraNodes()` 动态插入 LoraLoader 节点并串好 model/clip 引用；
6. 提交 `/prompt` → 轮询或 WS 等结果。

模板占位符（写在 `presets/defaults.js` 的工作流 JSON 里）：

| 占位符 | 含义 |
| --- | --- |
| `%prompt%` `%negative_prompt%` | 正负提示词 |
| `%seed%` `%steps%` `%cfg_scale%` `%sampler_name%` `%SCHEDULER%` | 采样参数 |
| `%width%` `%height%` | 空 Latent 尺寸 |
| `%MODEL_NAME%` `%CLIP_NAME%` `%VAE_NAME%` `%CLIP_TYPE%` | 模型三件套 |
| `%image1%` … `%image9%` | 参考图（写进 LoadImage） |
| `%CLIP_SET_LAYER_NODE%` `%CLIP_REF%` `%LATENT_NODE%` `%AURAFLOW_NODE%` `%KSAMPLER_MODEL_REF%` `%LORA_MODEL_REF%` `%LORA_CLIP_REF%` `%LORA_NODES%` | 引擎内部使用，模板作者无需填 |

**两套模型格式分支**：`Checkpoint`（`CheckpointLoaderSimple` 一个节点搞定 CLIP+VAE）与 `DDUF`（UNET/CLIP/VAE 分开加载）。Checkpoint 下再按模型名判风格——SD/SDXL 系走 `CLIPSetLastLayer + karras`，Z-Image / Krea2 等 AuraFlow 系走 `ModelSamplingAuraFlow + simple + EmptySD3Latent`（`isSdxlCheckpointModel`）。

**采样预览**：`previewWanted()` 为真时建一条到 `ws://.../api/comfy-ws?target=` 的连接，后端只做字节级 pipe 不解帧，前端把二进制帧拼成 dataURL 塞进画布。

内置工作流共 16 个：DDUF 文生图 6 个（通用 / Z-Image Turbo / Krea 2 Turbo / Qwen-Image 2.1 / Anima-Base / MOSS-Image）、DDUF 图片编辑 8 个（Qwen-Image 2.1 / Turbo / 自定义 sigma / Qwen-image-edit / Flux3klein / Flux2klein / FireRed / Krea2）、Checkpoint 文生图与编辑各 1 个。

### 6.2 SD WebUI（`lib/engines/sd.js`，112 行）

最薄的一层：`/sdapi/v1/txt2img`，把 4 组 LoRA 拼成 `<lora:名:强度>` 追加到正向提示词，返回 base64 转 dataURL。`connect()` 拉 `/sdapi/v1/sd-models|samplers|loras` 填下拉。

### 6.3 云端 API（`lib/engines/otherapi.js`，466 行）

两种模式：

- **结构化**：按 `bodyFormat` 生成请求体，支持 `flat` / `simple` / `dashscope` / `qianfan` 四种；
- **自定义**：直接用 JSON 模板，占位符在字符串层面替换。

自定义请求体占位符：

```
${model} ${prompt} ${negative_prompt} ${size} ${size_star} ${steps}
${guidance} ${seed} ${n} ${ref_images} ${ref_images_dashscope} ${ref_images_api}
${api_key} ${url} ${task_id}（轮询用）
```

`asyncMode` 开启后走轮询：先取 `task_id`，再按 `poll` 模板反复请求直到出图。响应解析不写死路径，`extractImagesFromJson()` 会递归找 `url` / `b64_json` / `image` 等键——兼容各家长得不一样的返回结构。

内置 6 个平台预设：硅基流动、火山引擎、腾讯云(TokenHub)、阿里云（千问AI）、百度云(千帆)、魔搭社区。**模型池按预设独立**（`preset.models`），各家拉取的模型列表互不污染；旧版单一 `otherApiModels` 会在首次加载时迁移给当前活跃预设。

---

## 7. 备份包格式

`GET /api/export-all` 产出 zip，结构与插件「全量导出」互通，并额外包含画布与素材：

```
settings.json      设置（含 workbenchFormat: true）
manifest.json      { version, exportTime, workbench, settingCount,
                     imageCount, images: { key: {file} }, canvases: [], library: [] }
images/            生成图（output/ 直下）
images/imported_*  导入图（来自 output/imported/）
canvases/<id>.json 每张画布一个文件
library/<file>     上传素材
```

导入是**合并**语义，不是覆盖：设置浅合并、画布按 id upsert、素材去重后落盘、缓存图统一进历史（`engine: 'imported'`）。

前端导入**必须直接把 `File` 当二进制 body 发**，不能用 `readAsDataURL + JSON`——备份包会随生成图长到数百 MB，base64 膨胀 4/3 后既会撞服务端 body 上限，也会超过 V8 单字符串最大长度（约 512MB）直接抛 `RangeError`。

---

## 8. 配置项要点

设置全部存在 `settings.data`，前端默认值在 `lib/core/settings.js` 的 `defaultSettings`。几个值得单独说明的：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `cacheDays` | `'30'` | 历史保留天数；`'0'` = 永久。启动时按此清理 |
| `cacheHit` | `false` | 生成前缓存命中（按最终提示词匹配） |
| `samplePreview` | `false` | ComfyUI 采样实时预览，需后端 WS 代理 |
| `compareOn` | `true` | 结果图悬停对比参考图 |
| `AQT` / `UCP` | `''` | 正面/负面质量附加标签，自动拼进提示词 |
| `captionWriteMode` | `'append'` | 图片反推结果：追加 or 替换 |
| `rewriteWriteMode` | `'replace'` | 提示词优化结果：替换 or 追加 |

**图片反推与提示词优化**都不占独立模型，而是复用 ComfyUI 里的文本生成节点（`textgen` 模板）。流程：读 `/object_info` 拿到可用节点与 CLIP 类型枚举 → 按模型值反查所属模板 → 构造最小工作流 → 提交 → 从 `outputs` 里取第一个字符串结果。因此**这两个功能强依赖 ComfyUI 在线**，`captionEngine: 'off'` 时整块禁用。

---

## 9. 已知问题与技术债

按影响排序，均为代码可验证的现状，不是猜测。

### 高危：对公网暴露前必须处理

1. **无任何鉴权，且 `/api/proxy` 可代理任意地址。** 加上 `enableCors({ origin: true })`，任何能访问该端口的人都能把它当开放代理用（对内网服务的 SSRF 跳板，或对外发起请求）。**只应部署在本机或可信内网**；要公网使用，至少需要加认证 + 代理目标白名单。
2. **`synchronize: true`**（`app.module.ts`）。生产环境启动会按实体定义自动改表，改字段有可能丢数据。上线前应置为 `false` 并改用 migration。
3. **`express.json({ limit: '2100mb' })` 是全局的**，所有普通接口都能接收 2GB JSON 并整体进内存，一次并发大请求就可能打爆进程。
4. **自研 ZIP 不支持 ZIP64**（`zip.util.ts` 无 `0x06064b50`）。单项或总包超过 4GB 会写出损坏的包；备份包随生成图增长，这是迟早会撞上的硬上限。

### 中：功能/正确性

5. **备份导入把所有缓存图强制命名为 `.png`**（`backup.service.ts` 的 `applyImportZip`：`'imported_' + safeName(key) + '.png'`）。原始 jpg/webp 内容配 `.png` 后缀，浏览器靠 MIME 嗅探还能显示，但下载后扩展名是错的。
6. **历史查询全表拉取**（`history.service.getList` 先 `find()` 再内存 `filter/slice`），`deleteByTimestamps` 也是全表 `find()`。记录上万后每次打开页面都会明显变慢。
7. **`SettingsController.save` 里的 `merged` 变量算了但没用**，只返回 `{ok:true}`。调用方拿不到合并后的结果，得自己再 GET 一次。
8. **`storage-files` 对 library 返回 `size: 0`**（只读库表不读磁盘），前端显示的大小是假的。
9. **`library` 表 `name` 与 `file` 完全重复**，删除按文件名批量操作、不校验记录是否存在，删不存在的名字静默通过。
10. **版本号不一致**：`/api/app-info` 硬编码 `1.5.0`，两个 `package.json` 都是 `1.0.0`。

### 低：工程规范

11. 无测试、无 lint 脚本（`package.json` 只有 build/start）。
12. `backend/src` 无 `dto/`，控制器直接吃 `any`，`class-validator` 装了但没用。
13. 前端 167KB 的 `presets/defaults.js` 全量打进主包（含 16 个工作流模板与全部 API 预设），首屏体积因此偏大，可考虑拆懒加载。
14. `data/canvases/` 目录被创建但从未使用（画布存 MySQL），属于历史残留。

---

## 10. 开发约定

- **前端出网一律走 `WB.http`**，不要在组件里直接 `fetch` 外部域名。
- **新增引擎**：`WB.engines.register('id', { connect, generate })` 即可，不要改 `index.js` 的分发逻辑。
- **新增工作流模板**：在 `defaults.js` 里加 JSON 字符串，占位符用上表；`builtin: true` 的预设快照会随版本强制刷新，本地改动不保留。
- **新增设置项**：`defaultSettings` 加键 → `settings.init()` 会自动把已存值合并进来（旧数据缺键时用默认值），无需迁移脚本。
- **代码注释**：函数头部写用途/参数/返回值；核心业务逐段注释；复杂逻辑块加整体思路说明。现有代码基本遵循，改动时保持一致。
