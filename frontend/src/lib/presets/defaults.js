// ============================================================
// AI图片工作台 - 内置预设：ComfyUI 工作流模板 + 云端API预设 + 尺寸预设
// 工作流模板移植自文生图工具2.0（去除 IPAdapter 参考节点组，新增 %image1%… 参考图占位符）
// ============================================================
'use strict';

WB.presets = WB.presets || {};

// 内置工作流模板（占位符由 engines/comfyui.js 的 replacepro 替换）：
//   %prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name% %width% %height%
//   %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE% %SCHEDULER%
//   %CLIP_SET_LAYER_NODE% %CLIP_REF% %LATENT_NODE% %AURAFLOW_NODE% %KSAMPLER_MODEL_REF%
//   %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES%
//   参考图占位符：%image1% %image2% …（写在 LoadImage 节点的 image 字段，生成时注入对应参考图 dataURL）
(function () {

  // Checkpoint 类型模板（CheckpointLoaderSimple 内置 CLIP+VAE；兼容 SDXL 与 AuraFlow 系单文件模型）
  const jsonCkpt = `// ═══════════════════════════════════════════════════════════════
// 工作流：Checkpoint类型文生图模板（通用）
// 模型格式：Checkpoint（由 CheckpointLoaderSimple 一个节点加载，内置 CLIP+VAE）
// ═══════════════════════════════════════════════════════════════
//
// 一、支持的模型类型（典型例子）
//   · 单文件 Checkpoint 模型：z-image、krea2、qwen-image 等（AuraFlow 系）
//   · SDXL / SD 系列：SDXL、Juggernaut、DreamShaper 等
//   · 模型格式在「ComfyUI 设置」固定选择 Checkpoint，由 CheckpointLoaderSimple(节点20) 加载。
//
// 二、所需模型及在 ComfyUI 中的位置（支持子文件夹路径）
//   1) 主模型 Checkpoint：ComfyUI/models/checkpoints/（可放子文件夹，
//      如 mymodel.safetensors 或 subdir/mymodel.safetensors），由 %MODEL_NAME% 读取。
//   2) LoRA(可选)：ComfyUI/models/loras/（支持子文件夹路径），在下方「LoRA 模型」
//      comfyLora1~4 中选择并启用。
//   （Checkpoint 内含 CLIP 与 VAE，无需单独放置）
//
// 三、使用说明
//   1) 未指定任何类型的模型时，请在「模型选择」下拉框中自行选择；
//   2) 本模板会根据模型类型自动进入不同分支（SDXL/SD 系走 CLIPSetLastLayer+karras，
//      z-image/krea2 等 AuraFlow 系走 ModelSamplingAuraFlow+simple+EmptySD3Latent）。
//      如需固定某类型，也可自行写单分支工作流；
//   3) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度即可（通用 LoRA 注入）。
//   4) 这是通用模板，此类型（Checkpoint 文生图）工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 四、其他未尽说明
//   · 输出尺寸由「空 Latent」(节点8) 的 %width%/%height% 控制；
//   · 生成参数（步数/CFG/采样器/调度器/种子）由下方字段控制；
//   · 本模板未含参考图（%imageN%）槽位；如需图像编辑可参考对应编辑模板。
//
// 五、附录 · 支持的占位符及使用方法
//   · %prompt% / %negative_prompt%：提示词 / 负面提示词
//   · %seed% / %steps% / %cfg_scale% / %sampler_name% / %SCHEDULER%：种子/步数/CFG/采样器/调度器
//   · %width% / %height%：宽高（写进空 Latent 节点）
//   · %MODEL_NAME%：Checkpoint 模型名（写进 CheckpointLoaderSimple.ckpt_name）
//   · %image1% ~ %image9%：参考图（可选，需模板含对应 LoadImage 槽；本模板不含）
//   · 内部占位符（引擎自动处理，无需手工填写）：
//     %CLIP_SET_LAYER_NODE% %CLIP_REF% %LATENT_NODE% %AURAFLOW_NODE% %KSAMPLER_MODEL_REF%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//   · 使用方式：正文 JSON 即标准 ComfyUI 工作流；引擎在提交前完成占位符替换、
//     参考图上传注入 / 空槽裁剪、LoRA 自动挂载，无需手工干预。
// ═══════════════════════════════════════════════════════════════
{
    %CLIP_SET_LAYER_NODE%
    "5": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "%SCHEDULER%",
        "denoise": 1,
        "model": [
          %KSAMPLER_MODEL_REF%
        ],
        "positive": [
          "6",
          0
        ],
        "negative": [
          "7",
          0
        ],
        "latent_image": [
          "8",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "6": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "7": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "8": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      %LATENT_NODE%
      "_meta": {
        "title": "空Latent"
      }
    },
    "20": {
      "inputs": {
        "ckpt_name": "%MODEL_NAME%"
      },
      "class_type": "CheckpointLoaderSimple",
      "_meta": {
        "title": "Checkpoint加载器(简易)"
      }
    }
    %AURAFLOW_NODE%
    ,
    "31": {
      "inputs": {
        "samples": [
          "5",
          0
        ],
        "vae": [
          "20",
          2
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "122": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "31",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  // DDUF 类型模板（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
  const jsonDduf = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（通用）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、支持的模型类型（典型例子）
//   · z-image / qwen-image / krea2 / f2k（flux-2-klein）/ qwen-image-edit 等
//   · CLIP 类型(comfyClipType) 在右侧选择（z-image→lumina2、qwen→qwen_image、
//     krea2→krea2、f2k→flux2…），由 %CLIP_TYPE% 读取。
//
// 二、所需模型及在 ComfyUI 中的位置（支持子文件夹路径）
//   1) 主模型 UNet：ComfyUI/models/diffusion_models/（可子文件夹），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：ComfyUI/models/text_encoders/（可子文件夹），由 %CLIP_NAME% 读取
//   3) VAE：ComfyUI/models/vae/（可子文件夹），由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/（可子文件夹），在下方「LoRA 模型」
//      comfyLora1~4 中选择并启用。
//
// 三、使用说明
//   1) 未指定任何类型的模型 / VAE / 文本编码器 / CLIP 类型 / LoRA 时，
//      请在各自下拉框中自行选择；
//   2) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（通用 LoRA 注入）；
//   3) 这是通用模板，此类型（DDUF 文生图）工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 四、其他未尽说明
//   · 输出尺寸由「空SD3 Latent」(节点5) 的 %width%/%height% 控制；
//   · 采样调度走 ModelSamplingAuraFlow(shift=3) + 调度器 simple；
//   · 本模板未含参考图（%imageN%）槽位；如需图像编辑可参考对应编辑模板。
//
// 五、附录 · 支持的占位符及使用方法
//   · %prompt% / %negative_prompt%：提示词 / 负面提示词
//   · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//   · %width% / %height%：宽高（写进空SD3 Latent）
//   · %MODEL_NAME%：UNet 模型名（UNETLoader.unet_name）
//   · %CLIP_NAME%：文本编码器名（CLIPLoader.clip_name）
//   · %VAE_NAME%：VAE 名（VAELoader.vae_name）
//   · %CLIP_TYPE%：CLIP 类型（CLIPLoader.type）
//   · %image1% ~ %image9%：参考图（可选，需模板含对应 LoadImage 槽；本模板不含）
//   · 内部占位符（引擎自动处理，无需手工填写）：
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//   · 使用方式：正文 JSON 即标准 ComfyUI 工作流；引擎在提交前完成占位符替换、
//     参考图上传注入 / 空槽裁剪、LoRA 自动挂载，无需手工干预。
// ═══════════════════════════════════════════════════════════════
{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "7": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": {
        "title": "AuraFlow采样节点"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %KSAMPLER_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  // Checkpoint 图片编辑模板：Qwen-Rapid-AIO 空 latent + 参考图引导的图像编辑（对齐官方独立工作流）
  const jsonRapidAIO = `// ═══════════════════════════════════════════════════════════════
// 工作流：Checkpoint 图片编辑模板（workflow_Qwen-Rapid-AIO）
//（Qwen-Rapid-AIO · 空 latent + 参考图引导的图像编辑，必需/可选参考图见正文）
// 模型格式：Checkpoint（由 CheckpointLoaderSimple 一个节点加载，内置 CLIP+VAE）
// 说明：本模板为「空 latent + 参考图 KV 引导」的文生图式编辑流——
//       KSampler 初始 latent 用空 latent（节点5，由 %width%/%height% 决定输出尺寸），
//       参考图经 TextEncodeQwenImageEditPlus（带 vae）编码注入采样条件来约束主体，
//       因此**不导入参考图时可自动退化为文生图**，导入 1~3 张则做图像编辑。
//       参考图喂视觉条件用 ImageScaleToTotalPixels 等比缩放，不裁剪、不变形；
//       输出尺寸严格遵守参数区 comfyWidth/comfyHeight。
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 Checkpoint：Qwen-Rapid-AIO-fp8.safetensors
//      ComfyUI/models/checkpoints/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) LoRA(可选)：本模板默认不依赖额外 LoRA（Qwen-Rapid-AIO 原生少步）；
//      如需更优加速，可把对应 Lightning LoRA 放入 ComfyUI/models/loras/，
//      并在「LoRA 模型」comfyLora1 选中（步数建议 4）。
//   （Checkpoint 内含 CLIP 与 VAE：CLIP 输出[1]供文本编码、VAE 输出[2]供参考图编码与解码，
//     TextEncodeQwenImageEditPlus 必须接 vae，否则参考图细节无法注入、导致“重新生成”）
//
// 二、使用方法
//   1) 文生图：不导入任何参考图即可生成（空 latent 为主体，参考图 image1/2/3 自动断开）；
//   2) 图像编辑：在参考图区导入 1~3 张，导入顺序即槽位 %image1% / %image2% / %image3%；
//   3) 输出尺寸由「空SD3 Latent」(节点5) 的 %width%/%height% 控制，严格遵守参数区设置；
//      参考图经等比缩放(1MP)喂视觉条件，不裁剪、不变形。
//
// 三、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 空槽闭包内节点删除；同时把“指向闭包节点”的已登记可选输入字段一并断开。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImageEditPlus(image1 / image2 / image3)
//   退化：0 图时 image1/2/3 全空，参考链被完整裁掉，空 latent 仍为主体 → 自动退化为文生图；
//         导入 2/3 张则保留对应 image 输入（3→1 自动退化）。
//
// 四、可实现的功能及使用方法
//   1) 文生图（0 参考图） / 图像编辑（1~3 张，参考图作为 KV 条件约束主体，保真依赖 vae）；
//   2) 这是通用图像编辑模板，此类型(Checkpoint 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 五、需注意的情形
//   1) 参考图保真依赖 TextEncode 的 vae 输入；若仍出现“重新生成、脸/服装变”说明 vae 未生效。
//   2) 本模板默认不加载 LoRA（Rapid-AIO 原生少步直接可用）；如需 LoRA，可在
//      「LoRA 模型」comfyLora1~4 选择（通用注入，勿硬编码 LoraLoader 节点）。
//   3) ComfyUI 缺节点：TextEncodeQwenImageEditPlus/FluxKontextMultiReferenceLatentMethod 来自 comfy-core，
//      ImageScaleToTotalPixels / EmptySD3LatentImage 为 comfy-core 标准节点；缺失时报“节点未找到”。
//   4) 模型格式必须选 Checkpoint；采样固定 sa_solver/beta(4步)，model 直连 checkpoint。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 输出 latent 用空 latent 节点（不依赖源图），故 0 图可退化为文生图、输出尺寸可控；
//   b. 参考图走节点可选输入(image1~3) 配合引擎可选输入裁剪，单/多图自适应；
//   c. 每张参考图进编码器前用 ImageScaleToTotalPixels(1MP) 等比缩放，不裁剪；
//   d. TextEncode 记得接 vae（参考图需解码注入条件），LoRA 用占位符交由工作台注入。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）← 本工作流即形态 B 示例
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词（Qwen 负面建议留空）
//      · %seed% / %steps% / %cfg_scale%：种子/步数/CFG（采样固定 sa_solver/beta，调度器内置于 KSampler）
//      · %width% / %height%：宽高（写进空SD3 Latent，决定输出尺寸）
//      · %MODEL_NAME%：Checkpoint 模型名（CheckpointLoaderSimple.ckpt_name）
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理，无需手工填写）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
  "1": {
    "inputs": { "clip": [%LORA_CLIP_REF%], "vae": ["20", 2], "image1": ["24", 0], "image2": ["26", 0], "image3": ["30", 0], "prompt": "%prompt%" },
    "class_type": "TextEncodeQwenImageEditPlus",
    "_meta": { "title": "Qwen编辑编码-正面" }
  },
  "2": {
    "inputs": { "clip": [%LORA_CLIP_REF%], "vae": ["20", 2], "image1": ["24", 0], "image2": ["26", 0], "image3": ["30", 0], "prompt": "" },
    "class_type": "TextEncodeQwenImageEditPlus",
    "_meta": { "title": "Qwen编辑编码-负面(留空)" }
  },
  "5": {
    "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1 },
    "class_type": "EmptySD3LatentImage",
    "_meta": { "title": "空SD3 Latent(输出尺寸)" }
  },
  "6": {
    "inputs": { "image": "%image1%", "upload": "image" },
    "class_type": "LoadImage",
    "_meta": { "title": "导入图片-1(参考,可选)" }
  },
  "7": {
    "inputs": { "image": "%image2%", "upload": "image" },
    "class_type": "LoadImage",
    "_meta": { "title": "导入图片-2(参考,可选)" }
  },
  "8": {
    "inputs": { "image": "%image3%", "upload": "image" },
    "class_type": "LoadImage",
    "_meta": { "title": "导入图片-3(参考,可选)" }
  },
  "20": {
    "inputs": { "ckpt_name": "%MODEL_NAME%" },
    "class_type": "CheckpointLoaderSimple",
    "_meta": { "title": "Checkpoint加载器(简易)" }
  },
  "24": {
    "inputs": { "image": ["6", 0], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 8 },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": { "title": "参考图1缩放(1MP,等比)" }
  },
  "26": {
    "inputs": { "image": ["7", 0], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 8 },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": { "title": "参考图2缩放(1MP,等比,可选)" }
  },
  "30": {
    "inputs": { "image": ["8", 0], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 8 },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": { "title": "参考图3缩放(1MP,等比,可选)" }
  },
  "31": {
    "inputs": { "samples": ["40", 0], "vae": ["20", 2] },
    "class_type": "VAEDecode",
    "_meta": { "title": "VAE解码" }
  },
  "32": {
    "inputs": { "filename_prefix": "ComfyUI", "images": ["31", 0] },
    "class_type": "SaveImage",
    "_meta": { "title": "保存图像" }
  },
  "40": {
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg_scale%",
      "sampler_name": "sa_solver",
      "scheduler": "beta",
      "denoise": 1,
      "model": [%LORA_MODEL_REF%],
      "positive": ["42", 0],
      "negative": ["43", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler",
    "_meta": { "title": "K采样器" }
  },
  "42": {
    "inputs": { "conditioning": ["1", 0], "reference_latents_method": "index_timestep_zero" },
    "class_type": "FluxKontextMultiReferenceLatentMethod",
    "_meta": { "title": "Kontext参考方法-正面" }
  },
  "43": {
    "inputs": { "conditioning": ["2", 0], "reference_latents_method": "index_timestep_zero" },
    "class_type": "FluxKontextMultiReferenceLatentMethod",
    "_meta": { "title": "Kontext参考方法-负面" }
  }
  %LORA_NODES%
}`;

// 内置工作流的默认参数快照（切换预设时连带切换模型/生成参数/LoRA，对齐插件 worker 快照机制）
  const jsonFluxKlein = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Flux2klein）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 UNet：flux-2-klein-9b-fp8.safetensors
//      ComfyUI/models/diffusion_models/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen_3_8b_fp8mixed.safetensors
//      ComfyUI/models/text_encoders/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=flux2
//   3) VAE：flux2-vae.safetensors
//      ComfyUI/models/vae/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/，在「LoRA 模型」comfyLora1~4 中选择并启用
//
// 二、使用方法
//   1) 文生图：不导入任何参考图即可直接生成（空 Flux2 Latent 作初始 latent）；
//   2) 图像编辑：在参考图区导入 1~3 张，导入顺序即槽位：
//      第1张→%image1%槽、第2张→%image2%槽、第3张→%image3%槽；
//   3) 输出尺寸由「空 Flux2 Latent」(节点5) 的 %width%/%height% 控制。
//
// 三、参考图自动裁剪机制（形态A｜旁路节点型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 自空槽求受影响闭包，删除其下游转换节点(如 VAEEncode、ImageScaleToTotalPixels)；
//     · 对旁路合并节点(本工作流 ReferenceLatent，主输入=conditioning)删除后，
//       把消费它的输入改接到主输入源，等价于图界面 bypass；
//     · KSampler 等主干节点是裁剪边界绝不触碰；最后做悬空链接兜底校验。
//   分类：本工作流属「形态A｜旁路节点型」，已登记在 BYPASS_INPUT_MAP
//     （ReferenceLatent：主输入 conditioning）。
//
//   登记说明（接入新编辑模型）：判定其参考图属于哪一类，在对应表加一行即可复用整套裁剪（不改算法）：
//     · 形态A｜旁路节点型 → BYPASS_INPUT_MAP 加一行（键=节点类型，值=主输入名）
//     · 形态B｜可选输入型 → OPTIONAL_INPUT_MAP 加一行（键=节点类型，值=可选输入名集合）
//
// 四、可实现的功能及使用方法
//   1) 文生图 / 图像编辑(1~3 张) / 无图退化为文生图；参考图越少 token 消耗越小。
//   2) 提示词建议肯定式，多图可用“图1/图2/图3”指代。
//   3) 未导入参考图时，整条参考链被完整裁掉，结构等价纯文生图，无需额外分支。
//
// 五、需注意的情形
//   1) 这是通用图像编辑模板，此类型(DDUF 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//   2) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（通用 LoRA 注入）；
//      若工作流绑定特定 LoRA 请务必在 comfyLoraN 选中，否则按默认效果生成。
//   3) 若 KSampler.latent_image 直接来自参考图 VAEEncode(img2img 底图)，
//      参考图即主干、无法退化为文生图；不导图会明确报错，此类至少需传 1 张。
//   4) 缺节点：ReferenceLatent/ImageScaleToTotalPixels 来自 comfy-core，需对应版本。
//   5) 输出分辨率由下方 comfyWidth/comfyHeight 决定。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 主干数据流不依赖参考图存在：初始 latent 用空 Latent 节点，正/负条件来自旁路合并；
//   b. 可选参考图一律走旁路合并节点接入主干(ReferenceLatent: conditioning=主输入)，
//      勿把参考图串在主干必由之路上；
//   c. 参考图进编码器前加 ImageScaleToTotalPixels(1MP) 控 token 与显存；
//   d. 参考槽 LoadImage.image 用 %image1%~%image9%；空槽自动裁剪；
//   e. LoRA 用占位符交由工作台注入，勿在 JSON 硬编码 LoraLoader。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词
//      · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//      · %width% / %height%：宽高（写进空 Latent 节点）
//      · %MODEL_NAME% / %CLIP_NAME% / %VAE_NAME% / %CLIP_TYPE%：UNet/编码器/VAE/CLIP 类型
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理，无需手工填写）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptyFlux2LatentImage",
      "_meta": {
        "title": "空Flux2 Latent(输出尺寸)"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %LORA_MODEL_REF%
        ],
        "positive": [
          "22",
          0
        ],
        "negative": [
          "23",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器(编辑)"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    },
    "11": {
      "inputs": {
        "image": "%image1%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-1(参考)"
      }
    },
    "12": {
      "inputs": {
        "pixels": [
          "24",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考1)"
      }
    },
    "13": {
      "inputs": {
        "image": "%image2%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-2(参考)"
      }
    },
    "14": {
      "inputs": {
        "pixels": [
          "25",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考2)"
      }
    },
    "15": {
      "inputs": {
        "image": "%image3%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-3(参考)"
      }
    },
    "16": {
      "inputs": {
        "pixels": [
          "26",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考3)"
      }
    },
    "17": {
      "inputs": {
        "conditioning": [
          "1",
          0
        ]
      },
      "class_type": "ConditioningZeroOut",
      "_meta": {
        "title": "条件零化(负面)"
      }
    },
    "18": {
      "inputs": {
        "conditioning": [
          "1",
          0
        ],
        "latent": [
          "12",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图1正面"
      }
    },
    "19": {
      "inputs": {
        "conditioning": [
          "17",
          0
        ],
        "latent": [
          "12",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图1负面"
      }
    },
    "20": {
      "inputs": {
        "conditioning": [
          "18",
          0
        ],
        "latent": [
          "14",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图2正面"
      }
    },
    "21": {
      "inputs": {
        "conditioning": [
          "19",
          0
        ],
        "latent": [
          "14",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图2负面"
      }
    },
    "22": {
      "inputs": {
        "conditioning": [
          "20",
          0
        ],
        "latent": [
          "16",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图3正面"
      }
    },
    "23": {
      "inputs": {
        "conditioning": [
          "21",
          0
        ],
        "latent": [
          "16",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图3负面"
      }
    },
    "24": {
      "inputs": {
        "image": [
          "11",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图1"
      }
    },
    "25": {
      "inputs": {
        "image": [
          "13",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图2"
      }
    },
    "26": {
      "inputs": {
        "image": [
          "15",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图3"
      }
    }
    %IPA_NODES%
    %LORA_NODES%
  }`;

  const jsonFlux3Klein = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Flux3klein）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 UNet：flux3_image_klein_sd_int8_convrot.safetensors（文件名带 _sd_ 为步数蒸馏版：官方模板默认 16 步 / CFG 1 实测可出图）
//      ComfyUI/models/diffusion_models/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen3vl_4b_int8_convrot.safetensors（Qwen3-VL-4B）
//      ComfyUI/models/text_encoders/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=flux3
//   3) VAE：flux2-vae.safetensors（FLUX.3 沿用 FLUX.2 的 VAE，无需另下）
//      ComfyUI/models/vae/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/，在「LoRA 模型」comfyLora1~4 中选择并启用
//   5) 提示词扩写(可选，本模板未接入)：qwen3.5_9b_flux3_prompt_upsampler_int8_convrot.safetensors
//      BFL 建议短提示词先经扩写再生成；需要时可在工作流里自行加 TextGenerate 分支
//
// 二、使用方法
//   1) 文生图：不导入任何参考图即可直接生成（空 Flux2 Latent 作初始 latent）；
//   2) 图像编辑：在参考图区导入 1~3 张，导入顺序即槽位：
//      第1张→%image1%槽、第2张→%image2%槽、第3张→%image3%槽；
//   3) 输出尺寸由「空 Flux2 Latent」(节点5) 的 %width%/%height% 控制。
//
// 三、参考图自动裁剪机制（形态A｜旁路节点型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 自空槽求受影响闭包，删除其下游转换节点(如 VAEEncode、ImageScaleToTotalPixels)；
//     · 对旁路合并节点(本工作流 ReferenceLatent，主输入=conditioning)删除后，
//       把消费它的输入改接到主输入源，等价于图界面 bypass；
//     · KSampler 等主干节点是裁剪边界绝不触碰；最后做悬空链接兜底校验。
//   分类：本工作流属「形态A｜旁路节点型」，已登记在 BYPASS_INPUT_MAP
//     （ReferenceLatent：主输入 conditioning）。
//
//   登记说明（接入新编辑模型）：判定其参考图属于哪一类，在对应表加一行即可复用整套裁剪（不改算法）：
//     · 形态A｜旁路节点型 → BYPASS_INPUT_MAP 加一行（键=节点类型，值=主输入名）
//     · 形态B｜可选输入型 → OPTIONAL_INPUT_MAP 加一行（键=节点类型，值=可选输入名集合）
//
// 四、可实现的功能及使用方法
//   1) 文生图 / 图像编辑(1~3 张) / 无图退化为文生图；参考图越少 token 消耗越小。
//   2) 提示词建议肯定式，多图可用“图1/图2/图3”指代。
//   3) 未导入参考图时，整条参考链被完整裁掉，结构等价纯文生图，无需额外分支。
//
// 五、需注意的情形
//   1) 这是通用图像编辑模板，此类型(DDUF 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//   2) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（通用 LoRA 注入）；
//      若工作流绑定特定 LoRA 请务必在 comfyLoraN 选中，否则按默认效果生成。
//   3) 若 KSampler.latent_image 直接来自参考图 VAEEncode(img2img 底图)，
//      参考图即主干、无法退化为文生图；不导图会明确报错，此类至少需传 1 张。
//   4) 缺节点：ReferenceLatent/ImageScaleToTotalPixels 来自 comfy-core，需对应版本。
//   5) 输出分辨率由下方 comfyWidth/comfyHeight 决定。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 主干数据流不依赖参考图存在：初始 latent 用空 Latent 节点，正/负条件来自旁路合并；
//   b. 可选参考图一律走旁路合并节点接入主干(ReferenceLatent: conditioning=主输入)，
//      勿把参考图串在主干必由之路上；
//   c. 参考图进编码器前加 ImageScaleToTotalPixels(1MP) 控 token 与显存；
//   d. 参考槽 LoadImage.image 用 %image1%~%image9%；空槽自动裁剪；
//   e. LoRA 用占位符交由工作台注入，勿在 JSON 硬编码 LoraLoader。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词
//      · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//      · %width% / %height%：宽高（写进空 Latent 节点）
//      · %MODEL_NAME% / %CLIP_NAME% / %VAE_NAME% / %CLIP_TYPE%：UNet/编码器/VAE/CLIP 类型
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理，无需手工填写）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptyFlux2LatentImage",
      "_meta": {
        "title": "空Flux2 Latent(输出尺寸)"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %LORA_MODEL_REF%
        ],
        "positive": [
          "22",
          0
        ],
        "negative": [
          "23",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器(编辑)"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    },
    "11": {
      "inputs": {
        "image": "%image1%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-1(参考)"
      }
    },
    "12": {
      "inputs": {
        "pixels": [
          "24",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考1)"
      }
    },
    "13": {
      "inputs": {
        "image": "%image2%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-2(参考)"
      }
    },
    "14": {
      "inputs": {
        "pixels": [
          "25",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考2)"
      }
    },
    "15": {
      "inputs": {
        "image": "%image3%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-3(参考)"
      }
    },
    "16": {
      "inputs": {
        "pixels": [
          "26",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "VAE编码(参考3)"
      }
    },
    "17": {
      "inputs": {
        "conditioning": [
          "1",
          0
        ]
      },
      "class_type": "ConditioningZeroOut",
      "_meta": {
        "title": "条件零化(负面)"
      }
    },
    "18": {
      "inputs": {
        "conditioning": [
          "1",
          0
        ],
        "latent": [
          "12",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图1正面"
      }
    },
    "19": {
      "inputs": {
        "conditioning": [
          "17",
          0
        ],
        "latent": [
          "12",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图1负面"
      }
    },
    "20": {
      "inputs": {
        "conditioning": [
          "18",
          0
        ],
        "latent": [
          "14",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图2正面"
      }
    },
    "21": {
      "inputs": {
        "conditioning": [
          "19",
          0
        ],
        "latent": [
          "14",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图2负面"
      }
    },
    "22": {
      "inputs": {
        "conditioning": [
          "20",
          0
        ],
        "latent": [
          "16",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图3正面"
      }
    },
    "23": {
      "inputs": {
        "conditioning": [
          "21",
          0
        ],
        "latent": [
          "16",
          0
        ]
      },
      "class_type": "ReferenceLatent",
      "_meta": {
        "title": "参考Latent-图3负面"
      }
    },
    "24": {
      "inputs": {
        "image": [
          "11",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图1"
      }
    },
    "25": {
      "inputs": {
        "image": [
          "13",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图2"
      }
    },
    "26": {
      "inputs": {
        "image": [
          "15",
          0
        ],
        "upscale_method": "nearest-exact",
        "megapixels": 1,
        "resolution_steps": 1
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图缩放(1MP)-图3"
      }
    }
    %IPA_NODES%
    %LORA_NODES%
  }`;

  const jsonKrea2 = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Krea2）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：传 1 张=单图编辑，传 2 张=双图编辑（引擎自动断开/保留 _b 输入）。
// 边界：krea2 编辑必需源图，故 不支持无图退化文生图（0 图会给出明确提示）；本模型仅两路参考。
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 UNet：krea2_turbo_fp8_scaled.safetensors
//      ComfyUI/models/diffusion_models/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen3vl_4b_fp8_scaled.safetensors
//      ComfyUI/models/text_encoders/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=krea2
//   3) VAE：qwen_image_vae.safetensors
//      ComfyUI/models/vae/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %VAE_NAME% 读取
//   4) LoRA：krea2_identity_edit_v1_2.safetensors（必需）
//      ComfyUI/models/loras/（本工作流已写死该路径；自定义工作流支持子文件夹路径），在「LoRA 模型」comfyLora1 选中并启用
//   5) 额外节点（需在 ComfyUI-Manager 安装，缺一不可）：
//      · comfyui-krea2edit —— 提供编辑节点 Krea2EditModelPatch / Krea2EditGroundedEncode
//      · comfyui-essentials —— 提供取尺寸节点 GetImageSize+
//      安装后重启 ComfyUI；未安装时报“节点未找到”。
//
// 二、使用方法
//   1) 单图编辑：在参考图区导入 1 张（%image1% 槽），引擎自动断开图2 的 _b 输入；
//   2) 双图编辑：导入 2 张（%image1% + %image2%），保留 _b 输入；
//   3) 提示词建议肯定式，双图可用“图1/图2”指代。
//
// 三、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 空槽闭包内的节点会被删除；同时把“指向闭包节点”的已登记可选输入字段一并断开。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · Krea2EditModelPatch(source_latent_b / source_image_b / ref_boost_mask)
//     · Krea2EditGroundedEncode(image_b)
//   单/双图即依赖此裁剪：单图时图2链路(节点13/26/29 与 _b 输入)自动裁剪掉。
//
//   登记说明（接入新编辑模型）：判定其参考图属于哪一类，在对应表加一行即可复用整套裁剪（不改算法）：
//     · 形态A｜旁路节点型 → BYPASS_INPUT_MAP 加一行（键=节点类型，值=主输入名）
//     · 形态B｜可选输入型 → OPTIONAL_INPUT_MAP 加一行（键=节点类型，值=可选输入名集合）
//
// 四、可实现的功能及使用方法
//   1) 单图编辑 / 双图编辑（图1 为主干必需源，图2 为可选增强参考）。
//   2) 输出尺寸 = 源图1 经缩放后的实际尺寸（GetImageSize+/节点27 决定），
//      不支持参数区自定义宽高；下方 comfyWidth/comfyHeight 仅作占位。
//   3) 这是通用图像编辑模板，此类型(DDUF 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 五、需注意的情形
//   1) 未上传任何图片：编辑流缺源图，引擎会明确提示“需先添加参考图”，不提交。
//   2) 本模型仅两路参考，无“第 3 张”概念，多余传入无效。
//   3) ComfyUI 缺插件：Krea2Edit* 来自 comfyui-krea2edit，GetImageSize+ 来自 comfyui-essentials。
//   4) LoRA 必须启用(comfyLora1=krea2_identity_edit_v1_2)且文件名匹配，否则身份编辑失效、效果明显变弱。
//   5) 源图过大：ImageScaleToTotalPixels 约 1MP，超大图会被压缩。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 图1 为主干必需源：LoadImage(%image1%) → ImageScaleToTotalPixels →
//      [GetImageSize 取尺寸、VAEEncode→source_latent、source_image、encode.image]；
//   b. 图2 走可选输入：LoadImage(%image2%) → ImageScaleToTotalPixels →
//      [VAEEncode→source_latent_b、source_image_b、encode.image_b]（引擎按是否传图断开）；
//   c. 可选参考一律走已登记的可选输入孔，勿串进主干必由之路；
//   d. LoRA 用占位符交由工作台注入，勿在 JSON 硬编码。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）← 本工作流即形态 B 示例
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词
//      · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//      · %width% / %height%：宽高占位（本工作流输出尺寸由 GetImageSize 决定）
//      · %MODEL_NAME% / %CLIP_NAME% / %VAE_NAME% / %CLIP_TYPE%：UNet/编码器/VAE/CLIP 类型
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(krea2)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(krea2)"
      }
    },
    "5": {
      "inputs": {
        "width": [
          "27",
          0
        ],
        "height": [
          "27",
          1
        ],
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "输出尺寸Latent(取自源图1)"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(krea2)"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          "18",
          0
        ],
        "positive": [
          "20",
          0
        ],
        "negative": [
          "19",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器(krea2编辑)"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    },
    "11": {
      "inputs": {
        "image": "%image1%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-1(编辑源图)"
      }
    },
    "13": {
      "inputs": {
        "image": "%image2%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-2(编辑源图,可选)"
      }
    },
    "18": {
      "inputs": {
        "model": [
          %LORA_MODEL_REF%
        ],
        "source_latent": [
          "25",
          0
        ],
        "source_latent_b": [
          "29",
          0
        ],
        "vae": [
          "4",
          0
        ],
        "source_image": [
          "24",
          0
        ],
        "source_image_b": [
          "26",
          0
        ],
        "target_latent": [
          "5",
          0
        ],
        "ref_boost": 4,
        "ref_boost_a": 1,
        "fit_mode": "fit"
      },
      "class_type": "Krea2EditModelPatch",
      "_meta": {
        "title": "Krea2编辑模型补丁(单/双)"
      }
    },
    "19": {
      "inputs": {
        "clip": [
          %LORA_CLIP_REF%
        ],
        "image": [
          "24",
          0
        ],
        "image_b": [
          "26",
          0
        ],
        "prompt": "",
        "grounding_px": 768,
        "system_prompt": ""
      },
      "class_type": "Krea2EditGroundedEncode",
      "_meta": {
        "title": "Krea2编辑编码-负面(留空)"
      }
    },
    "20": {
      "inputs": {
        "clip": [
          %LORA_CLIP_REF%
        ],
        "image": [
          "24",
          0
        ],
        "image_b": [
          "26",
          0
        ],
        "prompt": "%prompt%",
        "grounding_px": 768,
        "system_prompt": ""
      },
      "class_type": "Krea2EditGroundedEncode",
      "_meta": {
        "title": "Krea2编辑编码-正面"
      }
    },
    "24": {
      "inputs": {
        "image": [
          "11",
          0
        ],
        "upscale_method": "lanczos",
        "megapixels": 1,
        "resolution_steps": 8
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "源图1缩放(1MP)"
      }
    },
    "25": {
      "inputs": {
        "pixels": [
          "24",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "源图1VAE编码(source_latent)"
      }
    },
    "26": {
      "inputs": {
        "image": [
          "13",
          0
        ],
        "upscale_method": "lanczos",
        "megapixels": 1,
        "resolution_steps": 8
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "源图2缩放(1MP,可选)"
      }
    },
    "27": {
      "inputs": {
        "image": [
          "24",
          0
        ]
      },
      "class_type": "GetImageSize+",
      "_meta": {
        "title": "读取源图1尺寸"
      }
    },
    "29": {
      "inputs": {
        "pixels": [
          "26",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEEncode",
      "_meta": {
        "title": "源图2VAE编码(source_latent_b,可选)"
      }
    }
    %LORA_NODES%
    %IPA_NODES%
  }`;

  const jsonQwenEdit = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Qwen-image-edit）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：支持 文生图 / 图像编辑(最多3张参考) / 空图退化文生图，参考图 0~3 张可选。
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 UNet：Qwen-Image-Edit-2511-FP8.safetensors
//      ComfyUI/models/diffusion_models/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen_2.5_vl_7b_fp8_scaled.safetensors
//      ComfyUI/models/text_encoders/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=qwen_image
//   3) VAE：qwen_image_vae.safetensors
//      ComfyUI/models/vae/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %VAE_NAME% 读取
//   4) LoRA(推荐)：Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors（4步闪电加速）
//      ComfyUI/models/loras/（本工作流已写死该路径；自定义工作流支持子文件夹路径），在「LoRA 模型」comfyLora1 选中并启用；步数建议设 4。
//
// 二、使用方法
//   1) 文生图：不导入任何参考图即可生成（空 SD3 Latent 作初始 latent）；
//   2) 图像编辑：在参考图区导入 1~3 张，导入顺序即槽位：
//      第1张→%image1%槽、第2张→%image2%槽、第3张→%image3%槽；
//   3) 提示词建议肯定式，多图时可用“图1/图2/图3”指代。
//
// 三、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 空槽闭包内的节点会被删除；同时把“指向闭包节点”的已登记可选输入字段一并断开。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImageEditPlus(image1 / image2 / image3)
//   导入 1 张只用图1、2 张用图1+2、3 张全部生效，均由引擎自动裁剪适配。
//
//   登记说明（接入新编辑模型）：判定其参考图属于哪一类，在对应表加一行即可复用整套裁剪（不改算法）：
//     · 形态A｜旁路节点型 → BYPASS_INPUT_MAP 加一行（键=节点类型，值=主输入名）
//     · 形态B｜可选输入型 → OPTIONAL_INPUT_MAP 加一行（键=节点类型，值=可选输入名集合）
//
// 四、可实现的功能及使用方法
//   1) 文生图 / 图像编辑(1~3 张) / 空图退化为文生图。
//   2) 输出尺寸由「空 SD3 Latent」(节点5) 的 %width%/%height% 控制（可自定义尺寸）。
//   3) 这是通用图像编辑模板，此类型(DDUF 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 五、需注意的情形
//   1) 未上传参考图 = 文生图，可正常出图，无需传图。
//   2) ComfyUI 缺节点：TextEncodeQwenImageEditPlus/FluxKontextMultiReferenceLatentMethod 来自 comfy-core
//      （需对应版本），ImageScaleToTotalPixels 为 comfy-core 标准节点；缺失时报“节点未找到”。
//   3) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（通用 LoRA 注入）；
//      若 Lightning LoRA 未启用(comfyLora1=none)，请相应加大步数，否则效果/质量不足。
//   4) 参考图过大：ImageScaleToTotalPixels 约 1MP，超大图会被压缩。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 输出 latent 用空 Latent 节点（不依赖源图），故 0 图可退化为文生图；
//   b. 参考图走节点可选输入(image1~3) 而非硬编码在某条必经链上，配合引擎可选输入裁剪；
//   c. 每张参考图进编码器前用 ImageScaleToTotalPixels(1MP)；
//   d. LoRA 用占位符交由工作台注入，勿在 JSON 硬编码 LoraLoader 节点。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）← 本工作流即形态 B 示例
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词
//      · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//      · %width% / %height%：宽高（写进空 SD3 Latent）
//      · %MODEL_NAME% / %CLIP_NAME% / %VAE_NAME% / %CLIP_TYPE%：UNet/编码器/VAE/CLIP 类型
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(Qwen)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(Qwen)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent(输出尺寸)"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(Qwen)"
      }
    },
    "7": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": {
        "title": "AuraFlow采样节点"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          "14",
          0
        ],
        "positive": [
          "42",
          0
        ],
        "negative": [
          "43",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器(Qwen编辑)"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    },
    "11": {
      "inputs": {
        "image": "%image1%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-1(参考)"
      }
    },
    "13": {
      "inputs": {
        "image": "%image2%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-2(参考)"
      }
    },
    "14": {
      "inputs": {
        "strength": 1,
        "model": [
          "7",
          0
        ]
      },
      "class_type": "CFGNorm",
      "_meta": {
        "title": "CFG归一化"
      }
    },
    "15": {
      "inputs": {
        "image": "%image3%",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "导入图片-3(参考)"
      }
    },
    "19": {
      "inputs": {
        "clip": [
          %LORA_CLIP_REF%
        ],
        "vae": [
          "4",
          0
        ],
        "image1": [
          "24",
          0
        ],
        "image2": [
          "26",
          0
        ],
        "image3": [
          "30",
          0
        ],
        "prompt": ""
      },
      "class_type": "TextEncodeQwenImageEditPlus",
      "_meta": {
        "title": "Qwen编辑编码-负面(留空)"
      }
    },
    "20": {
      "inputs": {
        "clip": [
          %LORA_CLIP_REF%
        ],
        "vae": [
          "4",
          0
        ],
        "image1": [
          "24",
          0
        ],
        "image2": [
          "26",
          0
        ],
        "image3": [
          "30",
          0
        ],
        "prompt": "%prompt%"
      },
      "class_type": "TextEncodeQwenImageEditPlus",
      "_meta": {
        "title": "Qwen编辑编码-正面"
      }
    },
    "24": {
      "inputs": {
        "image": [
          "11",
          0
        ],
        "upscale_method": "lanczos",
        "megapixels": 1,
        "resolution_steps": 8
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图1缩放(1MP)"
      }
    },
    "26": {
      "inputs": {
        "image": [
          "13",
          0
        ],
        "upscale_method": "lanczos",
        "megapixels": 1,
        "resolution_steps": 8
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图2缩放(1MP)"
      }
    },
    "30": {
      "inputs": {
        "image": [
          "15",
          0
        ],
        "upscale_method": "lanczos",
        "megapixels": 1,
        "resolution_steps": 8
      },
      "class_type": "ImageScaleToTotalPixels",
      "_meta": {
        "title": "参考图3缩放(1MP)"
      }
    },
    "42": {
      "inputs": {
        "conditioning": [
          "20",
          0
        ],
        "reference_latents_method": "index_timestep_zero"
      },
      "class_type": "FluxKontextMultiReferenceLatentMethod",
      "_meta": {
        "title": "Kontext参考方法-正面"
      }
    },
    "43": {
      "inputs": {
        "conditioning": [
          "19",
          0
        ],
        "reference_latents_method": "index_timestep_zero"
      },
      "class_type": "FluxKontextMultiReferenceLatentMethod",
      "_meta": {
        "title": "Kontext参考方法-负面"
      }
    }
    %LORA_NODES%
    %IPA_NODES%
  }`;

  const jsonFireRed = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（FireRed）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：本流使用 TextEncodeQwenImageEditPlus（形态B｜Qwen-Image-Edit 系列），
//       %image1% 可选参考/编辑源图，%image2%/%image3% 可选附加参考，最多 3 张。
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（已指定，请按以下路径放入模型）
//   1) 主模型 UNet：FireRed-Image-Edit-1.1_fp8mixed_comfy.safetensors
//      路径 ComfyUI/models/diffusion_models/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen_2.5_vl_7b_fp8_scaled.safetensors
//      路径 ComfyUI/models/text_encoders/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=qwen_image
//   3) VAE：qwen_image_vae.safetensors
//      路径 ComfyUI/models/vae/（本工作流已写死该路径；自定义工作流支持子文件夹路径），由 %VAE_NAME% 读取
//   4) LoRA(推荐)：FireRed-Image-Edit-Lightning-8steps-v1.0.safetensors（8步闪电加速）
//      路径 ComfyUI/models/loras/（本工作流已写死该路径；自定义工作流支持子文件夹路径），在「LoRA 模型」comfyLora1 选中并启用
//
// 二、使用方法
//   1) 图像编辑：在参考图区导入 1~3 张，导入顺序即槽位 %image1% / %image2% / %image3%；
//   2) 提示词建议肯定式，多图时可用“图1/图2/图3”指代；
//   3) 输出尺寸由「空 Latent」(节点16) 的 %width%/%height% 控制。
//
// 三、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——
//     · 空槽闭包内的节点会被删除；同时把“指向闭包节点”的已登记可选输入字段一并断开。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImageEditPlus(image1 / image2 / image3)
//   导入 1 张只用图1、2 张用图1+2、3 张全部生效，均由引擎自动裁剪适配。
//
//   登记说明（接入新编辑模型）：判定其参考图属于哪一类，在对应表加一行即可复用整套裁剪（不改算法）：
//     · 形态A｜旁路节点型 → BYPASS_INPUT_MAP 加一行（键=节点类型，值=主输入名）
//     · 形态B｜可选输入型 → OPTIONAL_INPUT_MAP 加一行（键=节点类型，值=可选输入名集合）
//
// 四、可实现的功能及使用方法
//   1) 图像编辑（最多 3 张参考），参考图可为一张编辑源图。
//   2) 这是通用图像编辑模板，此类型(DDUF 图像编辑)工作流均可参考本工作流进行扩展，
//      也可根据需要自行增加特定节点。
//
// 五、需注意的情形
//   1) 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（通用 LoRA 注入）；
//      本流绑定 Lightning 8步 LoRA，请在 comfyLora1 选中，否则请相应加大步数。
//   2) ComfyUI 缺节点：TextEncodeQwenImageEditPlus 来自 comfy-core（需对应版本），
//      ImageScaleToTotalPixels / EmptyLatentImage 为 comfy-core 标准节点；缺失时报“节点未找到”。
//   3) 本流不使用 Checkpoint，模型格式请选 DDUF；运行前请先更新 ComfyUI。
//   4) 参考图过大：ImageScaleToTotalPixels 约 1MP，超大图会被压缩。
//
// 六、「图像编辑工作流」的规范写法要点
//   a. 输出 latent 用空 Latent 节点（不依赖源图）；
//   b. 参考图走节点可选输入(image1~3) 而非硬编码在某条必经链上，配合引擎可选输入裁剪；
//   c. 每张参考图进编码器前用 ImageScaleToTotalPixels(1MP)；
//   d. LoRA 用占位符交由工作台注入，勿在 JSON 硬编码 LoraLoader 节点。
//
// 七、附录
//   1) 所有支持的模型类型（参考接法 → 登记表）
//      | 形态A｜Flux 系列（ReferenceLatent：conditioning）
//      | 形态A｜OmniGen2 系列（ReferenceLatent）
//      | 形态B｜Qwen-Image-Edit 系列（TextEncodeQwenImageEditPlus.image1/image2/image3）← 本工作流即形态 B 示例
//      | 形态B｜Krea2 系列（Krea2EditModelPatch.source_latent_b/source_image_b/ref_boost_mask、
//               Krea2EditGroundedEncode.image_b）
//      | 形态B｜LongCat-Image-Edit（动态节点 .image）
//      | 形态B｜Mage-Flow-Edit（动态节点 .images.image_1/image_2/image_3）
//      | 形态B｜HiDream-E1/E1.1（InstructPixToPixConditioning.pixels）
//   2) 已支持的占位符及使用方式
//      · %prompt% / %negative_prompt%：提示词 / 负面提示词
//      · %seed% / %steps% / %cfg_scale% / %sampler_name%：种子/步数/CFG/采样器（调度器固定 simple）
//      · %width% / %height%：宽高（写进空 Latent 节点）
//      · %MODEL_NAME% / %CLIP_NAME% / %VAE_NAME% / %CLIP_TYPE%：UNet/编码器/VAE/CLIP 类型
//      · %image1% ~ %image9%：参考图占位符（写入 LoadImage.image，生成时注入上传文件名，空槽自动裁剪）
//      · 内部占位符（引擎自动处理）：%LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
//      · 使用方式：引擎在提交前完成占位符替换、参考图上传注入/空槽裁剪、LoRA 自动挂载。
// ═══════════════════════════════════════════════════════════════
{
  "1": {
    "inputs": { "unet_name": "%MODEL_NAME%", "weight_dtype": "default" },
    "class_type": "UNETLoader",
    "_meta": { "title": "FireRed UNet" }
  },
  "2": {
    "inputs": { "clip_name": "%CLIP_NAME%", "type": "%CLIP_TYPE%" },
    "class_type": "CLIPLoader",
    "_meta": { "title": "文本编码器" }
  },
  "3": {
    "inputs": { "vae_name": "%VAE_NAME%" },
    "class_type": "VAELoader",
    "_meta": { "title": "VAE" }
  },
  "4": {
    "inputs": { "image": "%image1%" },
    "class_type": "LoadImage",
    "_meta": { "title": "参考图1" }
  },
  "5": {
    "inputs": { "upscale_method": "bilinear", "megapixels": 1.0, "resolution_steps": 8, "image": ["4", 0] },
    "class_type": "ImageScaleToTotalPixels",
    "_meta": { "title": "参考图缩放" }
  },
  "7": {
    "inputs": { "clip": [%LORA_CLIP_REF%], "vae": ["3", 0], "image1": ["5", 0], "image2": ["9", 0], "image3": ["10", 0], "prompt": "%prompt%" },
    "class_type": "TextEncodeQwenImageEditPlus",
    "_meta": { "title": "正向编辑条件" }
  },
  "8": {
    "inputs": { "clip": [%LORA_CLIP_REF%], "vae": ["3", 0], "image1": ["5", 0], "image2": ["9", 0], "image3": ["10", 0], "prompt": "" },
    "class_type": "TextEncodeQwenImageEditPlus",
    "_meta": { "title": "负向条件(留空)" }
  },
  "9": {
    "inputs": { "image": "%image2%" },
    "class_type": "LoadImage",
    "_meta": { "title": "参考图2(可选)" }
  },
  "10": {
    "inputs": { "image": "%image3%" },
    "class_type": "LoadImage",
    "_meta": { "title": "参考图3(可选)" }
  },
  "11": {
    "inputs": { "shift": 3, "model": [%LORA_MODEL_REF%] },
    "class_type": "ModelSamplingAuraFlow",
    "_meta": { "title": "AuraFlow采样" }
  },
  "12": {
    "inputs": { "model": ["11", 0], "strength": 1.0 },
    "class_type": "CFGNorm",
    "_meta": { "title": "CFG归一化" }
  },
  "13": {
    "inputs": { "model": ["12", 0], "positive": ["7", 0], "negative": ["8", 0], "latent_image": ["16", 0], "seed": "%seed%", "steps": "%steps%", "cfg": "%cfg_scale%", "sampler_name": "%sampler_name%", "scheduler": "simple", "denoise": 1 },
    "class_type": "KSampler",
    "_meta": { "title": "采样器" }
  },
  "14": {
    "inputs": { "samples": ["13", 0], "vae": ["3", 0] },
    "class_type": "VAEDecode",
    "_meta": { "title": "Latent→图像" }
  },
  "15": {
    "inputs": { "images": ["14", 0], "filename_prefix": "firered_edit" },
    "class_type": "SaveImage",
    "_meta": { "title": "保存输出" }
  },
  "16": {
    "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1 },
    "class_type": "EmptyLatentImage",
    "_meta": { "title": "输出尺寸" }
  }
  %LORA_NODES%
}`;

  const jsonQwen21 = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Qwen-image-2.1）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：Qwen-Image-2.1（7B）编辑/生图一体流——不导图=文生图，导图=图像编辑；
//       参考图最多 8 张（%image1%~%image8%，导入顺序即槽位顺序），空槽自动裁剪。
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型及在 ComfyUI 中的位置（支持子文件夹路径）
//   1) 主模型 UNet：qwen_image_2.1_int8_convrot.safetensors
//      ComfyUI/models/diffusion_models/（如放子文件夹则填 子目录/文件名），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen3vl_8b_int8_convrot.safetensors（Qwen3-VL 8B）
//      ComfyUI/models/text_encoders/，由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=qwen_image
//      ⚠ qwen3.5_9b_qwen_image_2.1_pe_t2i / pe_i2i 是官方可选「提示词增强器」(PE)，
//        不是文本编码器，不能填进 CLIP 加载器。
//   3) VAE：qwen_image_2.1_vae_bf16.safetensors（四通道 RGB+Alpha，可直接生成透明底图）
//      ComfyUI/models/vae/，由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/，在「LoRA 模型」comfyLora1~4 中选择并启用
//
// 二、【参考图张数】最多支持 8 张，0~8 张任意数量均可
//   · 不导入参考图 → 自动退化为文生图（8 条参考链整体裁掉，正常出图）；
//   · 导入 1~8 张 → 图像编辑，导入顺序即槽位：第1张→%image1% … 第8张→%image8%；
//     例：只导入 3 张 → 仅 %image1%/%image2%/%image3% 生效，其余 5 条参考链自动裁掉；
//   · 提示词用 <image1> <image2> … 指代参考图（Qwen-Image-2.1 官方用法），例如：
//     保持 <image1> 的人物与姿势不变，把 <image2> 里的衣服给她穿上，保留原有面部特征；
//   · 生成透明底图：提示词需显式提到透明（官方建议含 RGBA image with transparency /
//     alpha channel / background is transparent 三项），否则不会输出透明背景。
//
// 三、输出尺寸规则（已按「有无参考图」在工作流层面分流，见节点32 开关）
//   · 无参考图（文生图）→ 走「画布」链：EmptyImage(节点30，宽=%width% 高=%height%)
//     → 编码取 latent(节点31)，输出严格 = 参数区 宽度 × 高度（32 对齐），高度同样生效；
//   · 有参考图（图像编辑）→ 走 Qwen2.1 编码节点(节点20) 的 latent，输出 =
//     第 1 张参考图按「分辨率档位」等比缩放后的尺寸（32 对齐）——这是官方推荐做法
//     （官方提示「换采样尺寸会让编辑发生偏移」，故编辑不强制套用参数区宽高）；
//   · 「分辨率档位」= 参数区「宽度」(%width%)，默认 1024（≈1MP）；它同时决定每张参考图
//     被缩放到的像素面积；档位/张数越大越吃显存，吃紧时把「宽度」调小（如 768/512）。
//   · 分流由 %has_ref% 占位符 + ComfySwitchNode(节点32) 完成：开关两侧输入是 lazy，
//     未选中的分支不会被执行，因此两条链同时存在也不产生额外算力浪费。
//
// 四、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——空槽闭包内节点（本流为
//     ImageScaleToTotalPixels）被删除，同时把指向闭包节点的已登记可选输入
//     （images.image_1 ~ images.image_8）一并断开，最后做悬空校验兜底。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImage21(images.image_1 ~ images.image_8)（官方节点共 16 槽，本流用 8 槽）
//   分流开关(节点32)的两侧输入分别来自节点20/节点31，均不在空槽闭包内，
//   因此它始终按主干节点保留，不参与裁剪，两条链结构稳定。
//
// 五、需注意的情形
//   1) 需较新版本 ComfyUI（Qwen-Image-2.1 为新支持）：TextEncodeQwenImage21 /
//      QwenImage21Cache 来自 comfy-core，缺失时报「节点未找到」；
//      若想省掉缓存节点：删掉节点 7，并把 KSampler.model 改接 LoRA 链末端（%LORA_MODEL_REF%）。
//   2) 参考图越多越吃显存/耗时（每张都会编码进条件序列），建议按需导入；参考图已用
//      ImageScaleToTotalPixels(1MP) 预缩放，减轻 token 压力。
//   3) 本流无需 CFGNorm / ModelSamplingAuraFlow（Qwen2.1 官方模板即 KSampler 直连缓存节点）。
//   4) LoRA 走占位符注入（comfyLora1~4），不要在 JSON 里硬编码 LoraLoader。
//
// 六、已支持的占位符（引擎自动处理，无需手工填写）
//   %prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//   %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//   %image1% ~ %image8%（参考图，空槽自动裁剪）
//   %has_ref%（有参考图=true / 无参考图=false，用于分流开关）
//   %ref_count%（参考图张数，供多态分支使用）
//   %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES%（内部占位符）
// ═══════════════════════════════════════════════════════════════
{
    "3": {
      "inputs": { "clip_name": "%CLIP_NAME%", "type": "%CLIP_TYPE%", "device": "default" },
      "class_type": "CLIPLoader",
      "_meta": { "title": "CLIP加载器(Qwen2.1编码器)" }
    },
    "4": {
      "inputs": { "vae_name": "%VAE_NAME%" },
      "class_type": "VAELoader",
      "_meta": { "title": "VAE加载器(Qwen2.1·RGB+Alpha)" }
    },
    "6": {
      "inputs": { "unet_name": "%MODEL_NAME%", "weight_dtype": "default" },
      "class_type": "UNETLoader",
      "_meta": { "title": "UNET加载器(Qwen2.1)" }
    },
    "7": {
      "inputs": { "device": "auto", "dtype": "default", "model": [ %LORA_MODEL_REF% ] },
      "class_type": "QwenImage21Cache",
      "_meta": { "title": "Qwen2.1缓存加速(device/dtype·可删,见说明)" }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [ "7", 0 ],
        "positive": [ "20", 0 ],
        "negative": [ "20", 1 ],
        "latent_image": [ "32", 0 ]
      },
      "class_type": "KSampler",
      "_meta": { "title": "K采样器(Qwen2.1)" }
    },
    "9": {
      "inputs": { "samples": [ "8", 0 ], "vae": [ "4", 0 ] },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE解码" }
    },
    "10": {
      "inputs": { "filename_prefix": "ComfyUI", "images": [ "9", 0 ] },
      "class_type": "SaveImage",
      "_meta": { "title": "保存图像" }
    },
    "20": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "%prompt%",
        "negative_prompt": "%negative_prompt%",
        "resolution": "%width%",
        "images.image_1": [ "121", 0 ],
        "images.image_2": [ "122", 0 ],
        "images.image_3": [ "123", 0 ],
        "images.image_4": [ "124", 0 ],
        "images.image_5": [ "125", 0 ],
        "images.image_6": [ "126", 0 ],
        "images.image_7": [ "127", 0 ],
        "images.image_8": [ "128", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "Qwen2.1编码(正/负条件·参考图·有图时的latent)" }
    },
    "30": { "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1, "color": 0 }, "class_type": "EmptyImage", "_meta": { "title": "画布(文生图尺寸=参数宽×高)" } },
    "31": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "",
        "negative_prompt": "",
        "resolution": 0,
        "images.image_1": [ "30", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "画布编码(只取latent·文生图用)" }
    },
    "32": {
      "inputs": { "switch": %has_ref%, "on_false": [ "31", 2 ], "on_true": [ "20", 2 ] },
      "class_type": "ComfySwitchNode",
      "_meta": { "title": "分流:无图→画布宽高 / 有图→首图尺寸" }
    },
    "111": { "inputs": { "image": "%image1%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-1(参考,可选)" } },
    "112": { "inputs": { "image": "%image2%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-2(参考,可选)" } },
    "113": { "inputs": { "image": "%image3%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-3(参考,可选)" } },
    "114": { "inputs": { "image": "%image4%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-4(参考,可选)" } },
    "115": { "inputs": { "image": "%image5%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-5(参考,可选)" } },
    "116": { "inputs": { "image": "%image6%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-6(参考,可选)" } },
    "117": { "inputs": { "image": "%image7%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-7(参考,可选)" } },
    "118": { "inputs": { "image": "%image8%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-8(参考,可选)" } },
    "121": { "inputs": { "image": [ "111", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图1缩放(1MP)" } },
    "122": { "inputs": { "image": [ "112", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图2缩放(1MP)" } },
    "123": { "inputs": { "image": [ "113", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图3缩放(1MP)" } },
    "124": { "inputs": { "image": [ "114", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图4缩放(1MP)" } },
    "125": { "inputs": { "image": [ "115", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图5缩放(1MP)" } },
    "126": { "inputs": { "image": [ "116", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图6缩放(1MP)" } },
    "127": { "inputs": { "image": [ "117", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图7缩放(1MP)" } },
    "128": { "inputs": { "image": [ "118", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图8缩放(1MP)" } }
    %LORA_NODES%
}`;

  // DDUF 图片编辑模板（Qwen-image-2.1 Turbo）：与标准版同结构，主模型为 Turbo 少步版（8 步 / euler / simple，默认尺寸 832×1216）
  const jsonQwen21Turbo = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Qwen-image-2.1 Turbo）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：Qwen-Image-2.1 Turbo（7B·少步加速版）编辑/生图一体流——
//       不导图=文生图，导图=图像编辑；参考图最多 8 张
//       （%image1%~%image8%，导入顺序即槽位顺序），空槽自动裁剪。
// ═══════════════════════════════════════════════════════════════
//
// 一、Turbo 版说明（与标准版的差异）
//   1) 主模型为 Turbo 蒸馏版：qwen_image_2.1_turbo_int8_convrot.safetensors，
//      默认 8 步即可出图（标准版约 25 步），采样器 euler + 调度器 simple；
//      cfg 保持 1（Turbo 模型 cfg>1 易过曝），如需更稳可把步数提到 10~12。
//   2) 默认尺寸 832×1216（≈3:4 竖版），可在参数区「预设尺寸」或宽高框自行更改。
//   3) 除上述默认值外，节点结构、参考图规则、占位符与标准版完全一致；
//      文本编码器 / VAE 与标准版通用（同一套 Qwen-Image-2.1 资产）。
//
// 二、所需模型及在 ComfyUI 中的位置（支持子文件夹路径）
//   1) 主模型 UNet：qwen_image_2.1_turbo_int8_convrot.safetensors（Turbo 少步版）
//      ComfyUI/models/diffusion_models/（如放子文件夹则填 子目录/文件名），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen3vl_8b_int8_convrot.safetensors（Qwen3-VL 8B）
//      ComfyUI/models/text_encoders/，由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=qwen_image
//      ⚠ qwen3.5_9b_qwen_image_2.1_pe_t2i / pe_i2i 是官方可选「提示词增强器」(PE)，
//        不是文本编码器，不能填进 CLIP 加载器。
//   3) VAE：qwen_image_2.1_vae_bf16.safetensors（四通道 RGB+Alpha，可直接生成透明底图）
//      ComfyUI/models/vae/，由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/，在「LoRA 模型」comfyLora1~4 中选择并启用
//
// 三、【参考图张数】最多支持 8 张，0~8 张任意数量均可
//   · 不导入参考图 → 自动退化为文生图（8 条参考链整体裁掉，正常出图）；
//   · 导入 1~8 张 → 图像编辑，导入顺序即槽位：第1张→%image1% … 第8张→%image8%；
//     例：只导入 3 张 → 仅 %image1%/%image2%/%image3% 生效，其余 5 条参考链自动裁掉；
//   · 提示词用 <image1> <image2> … 指代参考图（Qwen-Image-2.1 官方用法），例如：
//     保持 <image1> 的人物与姿势不变，把 <image2> 里的衣服给她穿上，保留原有面部特征；
//   · 生成透明底图：提示词需显式提到透明（官方建议含 RGBA image with transparency /
//     alpha channel / background is transparent 三项），否则不会输出透明背景。
//
// 四、输出尺寸规则（已按「有无参考图」在工作流层面分流，见节点32 开关）
//   · 无参考图（文生图）→ 走「画布」链：EmptyImage(节点30，宽=%width% 高=%height%)
//     → 编码取 latent(节点31)，输出严格 = 参数区 宽度 × 高度（32 对齐），高度同样生效；
//   · 有参考图（图像编辑）→ 走 Qwen2.1 编码节点(节点20) 的 latent，输出 =
//     第 1 张参考图按「分辨率档位」等比缩放后的尺寸（32 对齐）——这是官方推荐做法
//     （官方提示「换采样尺寸会让编辑发生偏移」，故编辑不强制套用参数区宽高）；
//   · 「分辨率档位」= 参数区「宽度」(%width%)，默认 832（≈1MP）；它同时决定每张参考图
//     被缩放到的像素面积；档位/张数越大越吃显存，吃紧时把「宽度」调小（如 768/512）。
//   · 分流由 %has_ref% 占位符 + ComfySwitchNode(节点32) 完成：开关两侧输入是 lazy，
//     未选中的分支不会被执行，因此两条链同时存在也不产生额外算力浪费。
//
// 五、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——空槽闭包内节点（本流为
//     ImageScaleToTotalPixels）被删除，同时把指向闭包节点的已登记可选输入
//     （images.image_1 ~ images.image_8）一并断开，最后做悬空校验兜底。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImage21(images.image_1 ~ images.image_8)（官方节点共 16 槽，本流用 8 槽）
//   分流开关(节点32)的两侧输入分别来自节点20/节点31，均不在空槽闭包内，
//   因此它始终按主干节点保留，不参与裁剪，两条链结构稳定。
//
// 六、需注意的情形
//   1) 需较新版本 ComfyUI（Qwen-Image-2.1 为新支持）：TextEncodeQwenImage21 /
//      QwenImage21Cache 来自 comfy-core，缺失时报「节点未找到」；
//      若想省掉缓存节点：删掉节点 7，并把 KSampler.model 改接 LoRA 链末端（%LORA_MODEL_REF%）。
//   2) 参考图越多越吃显存/耗时（每张都会编码进条件序列），建议按需导入；参考图已用
//      ImageScaleToTotalPixels(1MP) 预缩放，减轻 token 压力。
//   3) 本流无需 CFGNorm / ModelSamplingAuraFlow（Qwen2.1 官方模板即 KSampler 直连缓存节点）。
//   4) LoRA 走占位符注入（comfyLora1~4），不要在 JSON 里硬编码 LoraLoader。
//   5) Turbo 版步数偏少：改提示词后若觉得细节不足，先把步数提到 12 再判断是否模型问题。
//
// 七、已支持的占位符（引擎自动处理，无需手工填写）
//   %prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//   %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//   %image1% ~ %image8%（参考图，空槽自动裁剪）
//   %has_ref%（有参考图=true / 无参考图=false，用于分流开关）
//   %ref_count%（参考图张数，供多态分支使用）
//   %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES%（内部占位符）
// ═══════════════════════════════════════════════════════════════
{
    "3": {
      "inputs": { "clip_name": "%CLIP_NAME%", "type": "%CLIP_TYPE%", "device": "default" },
      "class_type": "CLIPLoader",
      "_meta": { "title": "CLIP加载器(Qwen2.1编码器)" }
    },
    "4": {
      "inputs": { "vae_name": "%VAE_NAME%" },
      "class_type": "VAELoader",
      "_meta": { "title": "VAE加载器(Qwen2.1·RGB+Alpha)" }
    },
    "6": {
      "inputs": { "unet_name": "%MODEL_NAME%", "weight_dtype": "default" },
      "class_type": "UNETLoader",
      "_meta": { "title": "UNET加载器(Qwen2.1)" }
    },
    "7": {
      "inputs": { "device": "auto", "dtype": "default", "model": [ %LORA_MODEL_REF% ] },
      "class_type": "QwenImage21Cache",
      "_meta": { "title": "Qwen2.1缓存加速(device/dtype·可删,见说明)" }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "%SCHEDULER%",
        "denoise": 1,
        "model": [ "7", 0 ],
        "positive": [ "20", 0 ],
        "negative": [ "20", 1 ],
        "latent_image": [ "32", 0 ]
      },
      "class_type": "KSampler",
      "_meta": { "title": "K采样器(Qwen2.1)" }
    },
    "9": {
      "inputs": { "samples": [ "8", 0 ], "vae": [ "4", 0 ] },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE解码" }
    },
    "10": {
      "inputs": { "filename_prefix": "ComfyUI", "images": [ "9", 0 ] },
      "class_type": "SaveImage",
      "_meta": { "title": "保存图像" }
    },
    "20": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "%prompt%",
        "negative_prompt": "%negative_prompt%",
        "resolution": "%width%",
        "images.image_1": [ "121", 0 ],
        "images.image_2": [ "122", 0 ],
        "images.image_3": [ "123", 0 ],
        "images.image_4": [ "124", 0 ],
        "images.image_5": [ "125", 0 ],
        "images.image_6": [ "126", 0 ],
        "images.image_7": [ "127", 0 ],
        "images.image_8": [ "128", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "Qwen2.1编码(正/负条件·参考图·有图时的latent)" }
    },
    "30": { "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1, "color": 0 }, "class_type": "EmptyImage", "_meta": { "title": "画布(文生图尺寸=参数宽×高)" } },
    "31": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "",
        "negative_prompt": "",
        "resolution": 0,
        "images.image_1": [ "30", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "画布编码(只取latent·文生图用)" }
    },
    "32": {
      "inputs": { "switch": %has_ref%, "on_false": [ "31", 2 ], "on_true": [ "20", 2 ] },
      "class_type": "ComfySwitchNode",
      "_meta": { "title": "分流:无图→画布宽高 / 有图→首图尺寸" }
    },
    "111": { "inputs": { "image": "%image1%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-1(参考,可选)" } },
    "112": { "inputs": { "image": "%image2%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-2(参考,可选)" } },
    "113": { "inputs": { "image": "%image3%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-3(参考,可选)" } },
    "114": { "inputs": { "image": "%image4%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-4(参考,可选)" } },
    "115": { "inputs": { "image": "%image5%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-5(参考,可选)" } },
    "116": { "inputs": { "image": "%image6%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-6(参考,可选)" } },
    "117": { "inputs": { "image": "%image7%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-7(参考,可选)" } },
    "118": { "inputs": { "image": "%image8%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-8(参考,可选)" } },
    "121": { "inputs": { "image": [ "111", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图1缩放(1MP)" } },
    "122": { "inputs": { "image": [ "112", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图2缩放(1MP)" } },
    "123": { "inputs": { "image": [ "113", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图3缩放(1MP)" } },
    "124": { "inputs": { "image": [ "114", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图4缩放(1MP)" } },
    "125": { "inputs": { "image": [ "115", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图5缩放(1MP)" } },
    "126": { "inputs": { "image": [ "116", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图6缩放(1MP)" } },
    "127": { "inputs": { "image": [ "117", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图7缩放(1MP)" } },
    "128": { "inputs": { "image": [ "118", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图8缩放(1MP)" } }
    %LORA_NODES%
}`;

  const jsonQwen21TurboSigma = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF图片编辑模板（Qwen-image-2.1 Turbo·自定义 sigma）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader）
// 说明：Qwen-Image-2.1 Turbo（7B·少步加速版）编辑/生图一体流——
//       不导图=文生图，导图=图像编辑；参考图最多 8 张
//       （%image1%~%image8%，导入顺序即槽位顺序），空槽自动裁剪。
// ═══════════════════════════════════════════════════════════════
//
// 零、与「Qwen-image-2.1 Turbo」标准模板的差异（仅采样链路）
//   KSampler（sigma 由调度器生成）→ SamplerCustom + Sigmas（固定网格）：
//     sample_sigmas = 1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0.0
//   ⚠ 因此参数区「步数」「调度器」对本流不生效（步数由数组长度固定为 8）；
//     CFG、种子、采样器、宽高、参考图规则仍照常生效。
//   ⚠ 网格节点用 ComfyUI-KJNodes 的「Custom Sigmas」（class_type: CustomSigmas），
//     新版 ComfyUI 已移除内置 Sigmas 节点；缺失 KJNodes 会报「节点未找到」。
//     interpolate_to_steps 必须 = 数组长度 − 1（本流 9 个值 → 8），否则会被对数插值改写。
//
// 一、Turbo 版说明（与标准版的差异）
//   1) 主模型为 Turbo 蒸馏版：qwen_image_2.1_turbo_int8_convrot.safetensors，
//      默认 8 步即可出图（标准版约 25 步），采样器 euler + 调度器 simple；
//      cfg 保持 1（Turbo 模型 cfg>1 易过曝），如需更稳可把步数提到 10~12。
//   2) 默认尺寸 832×1216（≈3:4 竖版），可在参数区「预设尺寸」或宽高框自行更改。
//   3) 除上述默认值外，节点结构、参考图规则、占位符与标准版完全一致；
//      文本编码器 / VAE 与标准版通用（同一套 Qwen-Image-2.1 资产）。
//
// 二、所需模型及在 ComfyUI 中的位置（支持子文件夹路径）
//   1) 主模型 UNet：qwen_image_2.1_turbo_int8_convrot.safetensors（Turbo 少步版）
//      ComfyUI/models/diffusion_models/（如放子文件夹则填 子目录/文件名），由 %MODEL_NAME% 读取
//   2) 文本编码器 CLIP：qwen3vl_8b_int8_convrot.safetensors（Qwen3-VL 8B）
//      ComfyUI/models/text_encoders/，由 %CLIP_NAME% 读取；CLIP 类型 comfyClipType=qwen_image
//      ⚠ qwen3.5_9b_qwen_image_2.1_pe_t2i / pe_i2i 是官方可选「提示词增强器」(PE)，
//        不是文本编码器，不能填进 CLIP 加载器。
//   3) VAE：qwen_image_2.1_vae_bf16.safetensors（四通道 RGB+Alpha，可直接生成透明底图）
//      ComfyUI/models/vae/，由 %VAE_NAME% 读取
//   4) LoRA(可选)：ComfyUI/models/loras/，在「LoRA 模型」comfyLora1~4 中选择并启用
//
// 三、【参考图张数】最多支持 8 张，0~8 张任意数量均可
//   · 不导入参考图 → 自动退化为文生图（8 条参考链整体裁掉，正常出图）；
//   · 导入 1~8 张 → 图像编辑，导入顺序即槽位：第1张→%image1% … 第8张→%image8%；
//     例：只导入 3 张 → 仅 %image1%/%image2%/%image3% 生效，其余 5 条参考链自动裁掉；
//   · 提示词用 <image1> <image2> … 指代参考图（Qwen-Image-2.1 官方用法），例如：
//     保持 <image1> 的人物与姿势不变，把 <image2> 里的衣服给她穿上，保留原有面部特征；
//   · 生成透明底图：提示词需显式提到透明（官方建议含 RGBA image with transparency /
//     alpha channel / background is transparent 三项），否则不会输出透明背景。
//
// 四、输出尺寸规则（已按「有无参考图」在工作流层面分流，见节点32 开关）
//   · 无参考图（文生图）→ 走「画布」链：EmptyImage(节点30，宽=%width% 高=%height%)
//     → 编码取 latent(节点31)，输出严格 = 参数区 宽度 × 高度（32 对齐），高度同样生效；
//   · 有参考图（图像编辑）→ 走 Qwen2.1 编码节点(节点20) 的 latent，输出 =
//     第 1 张参考图按「分辨率档位」等比缩放后的尺寸（32 对齐）——这是官方推荐做法
//     （官方提示「换采样尺寸会让编辑发生偏移」，故编辑不强制套用参数区宽高）；
//   · 「分辨率档位」= 参数区「宽度」(%width%)，默认 832（≈1MP）；它同时决定每张参考图
//     被缩放到的像素面积；档位/张数越大越吃显存，吃紧时把「宽度」调小（如 768/512）。
//   · 分流由 %has_ref% 占位符 + ComfySwitchNode(节点32) 完成：开关两侧输入是 lazy，
//     未选中的分支不会被执行，因此两条链同时存在也不产生额外算力浪费。
//
// 五、参考图自动裁剪机制（形态B｜可选输入型）
//   原理：仅对图片为空的 LoadImage 槽做拓扑裁剪——空槽闭包内节点（本流为
//     ImageScaleToTotalPixels）被删除，同时把指向闭包节点的已登记可选输入
//     （images.image_1 ~ images.image_8）一并断开，最后做悬空校验兜底。
//   分类：本工作流属「形态B｜可选输入型」，已登记在 OPTIONAL_INPUT_MAP：
//     · TextEncodeQwenImage21(images.image_1 ~ images.image_8)（官方节点共 16 槽，本流用 8 槽）
//   分流开关(节点32)的两侧输入分别来自节点20/节点31，均不在空槽闭包内，
//   因此它始终按主干节点保留，不参与裁剪，两条链结构稳定。
//
// 六、需注意的情形
//   1) 需较新版本 ComfyUI（Qwen-Image-2.1 为新支持）：TextEncodeQwenImage21 /
//      QwenImage21Cache 来自 comfy-core，缺失时报「节点未找到」；
//      若想省掉缓存节点：删掉节点 7，并把 KSampler.model 改接 LoRA 链末端（%LORA_MODEL_REF%）。
//   2) 参考图越多越吃显存/耗时（每张都会编码进条件序列），建议按需导入；参考图已用
//      ImageScaleToTotalPixels(1MP) 预缩放，减轻 token 压力。
//   3) 本流无需 CFGNorm / ModelSamplingAuraFlow（Qwen2.1 官方模板即 KSampler 直连缓存节点）。
//   4) LoRA 走占位符注入（comfyLora1~4），不要在 JSON 里硬编码 LoraLoader。
//   5) Turbo 版步数偏少：改提示词后若觉得细节不足，先把步数提到 12 再判断是否模型问题。
//
// 七、已支持的占位符（引擎自动处理，无需手工填写）
//   %prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//   %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//   %image1% ~ %image8%（参考图，空槽自动裁剪）
//   %has_ref%（有参考图=true / 无参考图=false，用于分流开关）
//   %ref_count%（参考图张数，供多态分支使用）
//   %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES%（内部占位符）
// ═══════════════════════════════════════════════════════════════
{
    "3": {
      "inputs": { "clip_name": "%CLIP_NAME%", "type": "%CLIP_TYPE%", "device": "default" },
      "class_type": "CLIPLoader",
      "_meta": { "title": "CLIP加载器(Qwen2.1编码器)" }
    },
    "4": {
      "inputs": { "vae_name": "%VAE_NAME%" },
      "class_type": "VAELoader",
      "_meta": { "title": "VAE加载器(Qwen2.1·RGB+Alpha)" }
    },
    "6": {
      "inputs": { "unet_name": "%MODEL_NAME%", "weight_dtype": "default" },
      "class_type": "UNETLoader",
      "_meta": { "title": "UNET加载器(Qwen2.1)" }
    },
    "7": {
      "inputs": { "device": "auto", "dtype": "default", "model": [ %LORA_MODEL_REF% ] },
      "class_type": "QwenImage21Cache",
      "_meta": { "title": "Qwen2.1缓存加速(device/dtype·可删,见说明)" }
    },
    "40": {
      "inputs": { "sampler_name": "%sampler_name%" },
      "class_type": "KSamplerSelect",
      "_meta": { "title": "采样器(参数区·默认euler)" }
    },
    "41": {
      "inputs": { "sigmas_string": "1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0.0", "interpolate_to_steps": 8 },
      "class_type": "CustomSigmas",
      "_meta": { "title": "Custom Sigmas(8步固定网格·需KJNodes)" }
    },
    "8": {
      "inputs": {
        "model": [ "7", 0 ],
        "add_noise": true,
        "noise_seed": "%seed%",
        "cfg": "%cfg_scale%",
        "positive": [ "20", 0 ],
        "negative": [ "20", 1 ],
        "sampler": [ "40", 0 ],
        "sigmas": [ "41", 0 ],
        "latent_image": [ "32", 0 ]
      },
      "class_type": "SamplerCustom",
      "_meta": { "title": "采样(8步固定sigma·CFG生效)" }
    },
    "9": {
      "inputs": { "samples": [ "8", 0 ], "vae": [ "4", 0 ] },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE解码" }
    },
    "10": {
      "inputs": { "filename_prefix": "ComfyUI", "images": [ "9", 0 ] },
      "class_type": "SaveImage",
      "_meta": { "title": "保存图像" }
    },
    "20": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "%prompt%",
        "negative_prompt": "%negative_prompt%",
        "resolution": "%width%",
        "images.image_1": [ "121", 0 ],
        "images.image_2": [ "122", 0 ],
        "images.image_3": [ "123", 0 ],
        "images.image_4": [ "124", 0 ],
        "images.image_5": [ "125", 0 ],
        "images.image_6": [ "126", 0 ],
        "images.image_7": [ "127", 0 ],
        "images.image_8": [ "128", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "Qwen2.1编码(正/负条件·参考图·有图时的latent)" }
    },
    "30": { "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1, "color": 0 }, "class_type": "EmptyImage", "_meta": { "title": "画布(文生图尺寸=参数宽×高)" } },
    "31": {
      "inputs": {
        "clip": [ %LORA_CLIP_REF% ],
        "vae": [ "4", 0 ],
        "prompt": "",
        "negative_prompt": "",
        "resolution": 0,
        "images.image_1": [ "30", 0 ]
      },
      "class_type": "TextEncodeQwenImage21",
      "_meta": { "title": "画布编码(只取latent·文生图用)" }
    },
    "32": {
      "inputs": { "switch": %has_ref%, "on_false": [ "31", 2 ], "on_true": [ "20", 2 ] },
      "class_type": "ComfySwitchNode",
      "_meta": { "title": "分流:无图→画布宽高 / 有图→首图尺寸" }
    },
    "111": { "inputs": { "image": "%image1%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-1(参考,可选)" } },
    "112": { "inputs": { "image": "%image2%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-2(参考,可选)" } },
    "113": { "inputs": { "image": "%image3%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-3(参考,可选)" } },
    "114": { "inputs": { "image": "%image4%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-4(参考,可选)" } },
    "115": { "inputs": { "image": "%image5%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-5(参考,可选)" } },
    "116": { "inputs": { "image": "%image6%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-6(参考,可选)" } },
    "117": { "inputs": { "image": "%image7%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-7(参考,可选)" } },
    "118": { "inputs": { "image": "%image8%", "upload": "image" }, "class_type": "LoadImage", "_meta": { "title": "导入图片-8(参考,可选)" } },
    "121": { "inputs": { "image": [ "111", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图1缩放(1MP)" } },
    "122": { "inputs": { "image": [ "112", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图2缩放(1MP)" } },
    "123": { "inputs": { "image": [ "113", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图3缩放(1MP)" } },
    "124": { "inputs": { "image": [ "114", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图4缩放(1MP)" } },
    "125": { "inputs": { "image": [ "115", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图5缩放(1MP)" } },
    "126": { "inputs": { "image": [ "116", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图6缩放(1MP)" } },
    "127": { "inputs": { "image": [ "117", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图7缩放(1MP)" } },
    "128": { "inputs": { "image": [ "118", 0 ], "upscale_method": "lanczos", "megapixels": 1, "resolution_steps": 32 }, "class_type": "ImageScaleToTotalPixels", "_meta": { "title": "参考图8缩放(1MP)" } }
    %LORA_NODES%
}`;

  // 内置工作流统一默认尺寸：832×1216（≈3:4 竖版，SDXL 常用档位）
  const BUILTIN_COMFY_SNAPSHOT = {
    comfyModelFormat: 'Checkpoint', MODEL_NAME: '', comfyTextEncoder: '', comfyVAE: '', comfyClipType: '',
    comfyWidth: '832', comfyHeight: '1216', comfySteps: '20', comfyCfgScale: '1',
    comfyuisamplerName: 'euler_ancestral', comfyScheduler: 'simple',
    comfyLora1: 'none', comfyLora1ModelStrength: 1, comfyLora1ClipStrength: 1,
    comfyLora2: 'none', comfyLora2ModelStrength: 1, comfyLora2ClipStrength: 1,
    comfyLora3: 'none', comfyLora3ModelStrength: 1, comfyLora3ClipStrength: 1,
    comfyLora4: 'none', comfyLora4ModelStrength: 1, comfyLora4ClipStrength: 1
  };

  const jsonZImageTurbo = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（Z-Image Turbo）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型（标准文件名，按以下路径放置；选模板后会自动选好这三项）
//   1) 主模型 UNet：Z-Image_Turbo_fp8.safetensors → ComfyUI/models/diffusion_models/
//   2) 文本编码器 CLIP：qwen_3_4b.safetensors → ComfyUI/models/text_encoders/（CLIP 类型 lumina2）
//   3) VAE：ae.safetensors → ComfyUI/models/vae/
//
// 二、推荐参数（已预置为模板默认值，可在参数区调整）
//   · 8 步 / CFG 1 / euler_ancestral / simple（Turbo 蒸馏版，CFG 固定 1）
//   · 输出尺寸由空 Latent(节点5) 的 %width%/%height% 控制，内置默认 832×1216
//   · 调度器固定 simple；%sampler_name% 走参数区的采样器
//
// 三、采样调度说明
//   · 本模型走 ModelSamplingAuraFlow(shift=3)，与模型原生采样对齐
//
// 四、使用说明
//   · 纯文生图，本模板不含参考图（%imageN%）槽位；需要图像编辑请选对应的编辑模板
//   · 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（引擎自动注入）
//   · 提示词写具体主体与画风即可，负面提示词在 CFG=1 下不参与计算
//   · 引擎替换的占位符：%prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//     %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
// ═══════════════════════════════════════════════════════════════

{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "7": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": {
        "title": "AuraFlow采样节点"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %KSAMPLER_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  const jsonKrea2Turbo = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（Krea 2 Turbo）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型（标准文件名，按以下路径放置；选模板后会自动选好这三项）
//   1) 主模型 UNet：krea2_turbo_fp8_scaled.safetensors → ComfyUI/models/diffusion_models/
//   2) 文本编码器 CLIP：qwen3vl_4b_fp8_scaled.safetensors → ComfyUI/models/text_encoders/（CLIP 类型 krea2）
//   3) VAE：qwen_image_vae.safetensors → ComfyUI/models/vae/
//
// 二、推荐参数（已预置为模板默认值，可在参数区调整）
//   · 8 步 / CFG 1 / euler_ancestral / simple（Turbo 版，CFG 固定 1）
//   · 输出尺寸由空 Latent(节点5) 的 %width%/%height% 控制，内置默认 832×1216
//   · 调度器固定 simple；%sampler_name% 走参数区的采样器
//
// 三、采样调度说明
//   · 本模型走 ModelSamplingAuraFlow(shift=3)，与模型原生采样对齐
//
// 四、使用说明
//   · 纯文生图，本模板不含参考图（%imageN%）槽位；需要图像编辑请选对应的编辑模板
//   · 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（引擎自动注入）
//   · Krea 2 还有 4 步加速 LoRA（krea2_turbo_4step_*），选中后步数改 4 即可
//   · 引擎替换的占位符：%prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//     %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
// ═══════════════════════════════════════════════════════════════

{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "7": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": {
        "title": "AuraFlow采样节点"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %KSAMPLER_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  const jsonQwen21T2I = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（Qwen-Image 2.1）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型（标准文件名，按以下路径放置；选模板后会自动选好这三项）
//   1) 主模型 UNet：qwen_image_2.1_int8_convrot.safetensors → ComfyUI/models/diffusion_models/
//   2) 文本编码器 CLIP：qwen3vl_8b_int8_convrot.safetensors → ComfyUI/models/text_encoders/（CLIP 类型 qwen_image）
//   3) VAE：qwen_image_2.1_vae_bf16.safetensors → ComfyUI/models/vae/
//
// 二、推荐参数（已预置为模板默认值，可在参数区调整）
//   · 25 步 / CFG 1 / euler / simple（官方 day-0 原生档；15 步可快速试稿，35 步更细）
//   · 输出尺寸由空 Latent(节点5) 的 %width%/%height% 控制，内置默认 832×1216
//   · 调度器固定 simple；%sampler_name% 走参数区的采样器
//
// 三、采样调度说明
//   · 本模型无固定 shift 要求，KSampler 直连模型（不插 ModelSampling 节点）
//
// 四、使用说明
//   · 纯文生图，本模板不含参考图（%imageN%）槽位；需要图像编辑请选对应的编辑模板
//   · 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（引擎自动注入）
//   · 本模板用核心 CLIPTextEncode；若要 Qwen21 缓存加速/专用编码节点，请用「DDUF图片编辑模板（Qwen-image-2.1）」那套
//   · 引擎替换的占位符：%prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//     %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
// ═══════════════════════════════════════════════════════════════

{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %LORA_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  const jsonAnimaBase = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（Anima-Base）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型（标准文件名，按以下路径放置；选模板后会自动选好这三项）
//   1) 主模型 UNet：anima-base-v1.0.safetensors → ComfyUI/models/diffusion_models/
//   2) 文本编码器 CLIP：qwen_3_06b_base.safetensors → ComfyUI/models/text_encoders/（CLIP 类型 qwen_image）
//   3) VAE：qwen_image_vae.safetensors → ComfyUI/models/vae/
//
// 二、推荐参数（已预置为模板默认值，可在参数区调整）
//   · 30 步 / CFG 4 / euler_ancestral / simple（Base 未蒸馏：官方建议 30~50 步、CFG 4~5）
//   · 输出尺寸由空 Latent(节点5) 的 %width%/%height% 控制，内置默认 832×1216
//   · 调度器固定 simple；%sampler_name% 走参数区的采样器
//
// 三、采样调度说明
//   · 本模型走 ModelSamplingAuraFlow(shift=3)，与模型原生采样对齐
//
// 四、使用说明
//   · 纯文生图，本模板不含参考图（%imageN%）槽位；需要图像编辑请选对应的编辑模板
//   · 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（引擎自动注入）
//   · 提示词用 Danbooru 标签（小写、空格代替下划线），前缀建议 masterpiece, best quality, score_7, safe
//   · 想快出图可改用 Anima-Turbo 权重，或挂 anima-turbo-lora 后把步数降到 8、CFG 1
//   · 引擎替换的占位符：%prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//     %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
// ═══════════════════════════════════════════════════════════════

{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": {
        "title": "空SD3 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "7": {
      "inputs": {
        "shift": 3,
        "model": [
          %LORA_MODEL_REF%
        ]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": {
        "title": "AuraFlow采样节点"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %KSAMPLER_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  const jsonMossImage = `// ═══════════════════════════════════════════════════════════════
// 工作流：DDUF类型文生图模板（MOSS-Image）
// 模型格式：DDUF（UNETLoader + CLIPLoader + VAELoader 三节点拆分）
// ═══════════════════════════════════════════════════════════════
//
// 一、所需模型（标准文件名，按以下路径放置；选模板后会自动选好这三项）
//   1) 主模型 UNet：moss_image_base_int8_convrot.safetensors → ComfyUI/models/diffusion_models/
//   2) 文本编码器 CLIP：qwen3.5_9b_int8_convrot.safetensors → ComfyUI/models/text_encoders/（CLIP 类型 moss_image）
//   3) VAE：flux2-vae.safetensors → ComfyUI/models/vae/（与 FLUX.2 共用）
//
// 二、推荐参数（已预置为模板默认值，可在参数区调整）
//   · 50 步 / CFG 3.5 / euler / simple（base 非蒸馏；sft 权重可自行调小步数）
//   · 输出尺寸由空 Latent(节点5) 的 %width%/%height% 控制，内置默认 832×1216
//   · 调度器固定 simple；%sampler_name% 走参数区的采样器
//
// 三、采样调度说明
//   · 本模型无固定 shift 要求，KSampler 直连模型（不插 ModelSampling 节点）
//
// 四、使用说明
//   · 纯文生图，本模板不含参考图（%imageN%）槽位；需要图像编辑请选对应的编辑模板
//   · 支持 LoRA：在「LoRA 模型」comfyLora1~4 中选择并设置强度（引擎自动注入）
//   · moss_image 需要 ComfyUI 开发版（master）及以上才支持，正式版 v0.41.3 及更早没有该类型
//   · 空 Latent 用 EmptyFlux2LatentImage（FLUX.2 潜空间），不要换成 SD3 的那一个
//   · 引擎替换的占位符：%prompt% %negative_prompt% %seed% %steps% %cfg_scale% %sampler_name%
//     %width% %height% %MODEL_NAME% %CLIP_NAME% %VAE_NAME% %CLIP_TYPE%
//     %LORA_MODEL_REF% %LORA_CLIP_REF% %LORA_NODES% %KSAMPLER_MODEL_REF%
// ═══════════════════════════════════════════════════════════════

{
    "1": {
      "inputs": {
        "text": "%prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-正面"
      }
    },
    "2": {
      "inputs": {
        "text": "%negative_prompt%",
        "clip": [
          %LORA_CLIP_REF%
        ]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP文本编码器-负面"
      }
    },
    "3": {
      "inputs": {
        "clip_name": "%CLIP_NAME%",
        "type": "%CLIP_TYPE%",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "CLIP加载器(DDUF)"
      }
    },
    "4": {
      "inputs": {
        "vae_name": "%VAE_NAME%"
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "VAE加载器(DDUF)"
      }
    },
    "5": {
      "inputs": {
        "width": "%width%",
        "height": "%height%",
        "batch_size": 1
      },
      "class_type": "EmptyFlux2LatentImage",
      "_meta": {
        "title": "空Flux2 Latent"
      }
    },
    "6": {
      "inputs": {
        "unet_name": "%MODEL_NAME%",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNET加载器(DDUF)"
      }
    },
    "8": {
      "inputs": {
        "seed": "%seed%",
        "steps": "%steps%",
        "cfg": "%cfg_scale%",
        "sampler_name": "%sampler_name%",
        "scheduler": "simple",
        "denoise": 1,
        "model": [
          %LORA_MODEL_REF%
        ],
        "positive": [
          "1",
          0
        ],
        "negative": [
          "2",
          0
        ],
        "latent_image": [
          "5",
          0
        ]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "K采样器"
      }
    },
    "9": {
      "inputs": {
        "samples": [
          "8",
          0
        ],
        "vae": [
          "4",
          0
        ]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "10": {
      "inputs": {
        "filename_prefix": "ComfyUI",
        "images": [
          "9",
          0
        ]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "保存图像"
      }
    }
    %LORA_NODES%
  }`;

  WB.presets.builtinWorkers = function () {
    return {
      'DDUF类型文生图模板': {
        workflow: jsonDduf, builtin: true, note: 'DDUF类型文生图模板（UNET+CLIP+VAE 拆分）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, { comfyModelFormat: 'DDUF', comfySteps: '8', comfyCfgScale: '1', comfyScheduler: 'simple' })
      },
      'DDUF文生图模板（Z-Image Turbo）': {
        workflow: jsonZImageTurbo, builtin: true, note: 'DDUF文生图模板（Z-Image Turbo，8步）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, {
          comfyModelFormat: 'DDUF',
          MODEL_NAME: 'Z-Image_Turbo_fp8.safetensors',
          comfyTextEncoder: 'qwen_3_4b.safetensors',
          comfyVAE: 'ae.safetensors',
          comfyClipType: 'lumina2',
          comfySteps: '8', comfyCfgScale: '1',
          comfyuisamplerName: 'euler_ancestral', comfyScheduler: 'simple'
        })
      },
      'DDUF文生图模板（Krea 2 Turbo）': {
        workflow: jsonKrea2Turbo, builtin: true, note: 'DDUF文生图模板（Krea 2 Turbo，8步）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, {
          comfyModelFormat: 'DDUF',
          MODEL_NAME: 'krea2_turbo_fp8_scaled.safetensors',
          comfyTextEncoder: 'qwen3vl_4b_fp8_scaled.safetensors',
          comfyVAE: 'qwen_image_vae.safetensors',
          comfyClipType: 'krea2',
          comfySteps: '8', comfyCfgScale: '1',
          comfyuisamplerName: 'euler_ancestral', comfyScheduler: 'simple'
        })
      },
      'DDUF文生图模板（Qwen-Image 2.1）': {
        workflow: jsonQwen21T2I, builtin: true, note: 'DDUF文生图模板（Qwen-Image 2.1，25步）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, {
          comfyModelFormat: 'DDUF',
          MODEL_NAME: 'qwen_image_2.1_int8_convrot.safetensors',
          comfyTextEncoder: 'qwen3vl_8b_int8_convrot.safetensors',
          comfyVAE: 'qwen_image_2.1_vae_bf16.safetensors',
          comfyClipType: 'qwen_image',
          comfySteps: '25', comfyCfgScale: '1',
          comfyuisamplerName: 'euler', comfyScheduler: 'simple'
        })
      },
      'DDUF文生图模板（Anima-Base）': {
        workflow: jsonAnimaBase, builtin: true, note: 'DDUF文生图模板（Anima-Base，30步 CFG4）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, {
          comfyModelFormat: 'DDUF',
          MODEL_NAME: 'anima-base-v1.0.safetensors',
          comfyTextEncoder: 'qwen_3_06b_base.safetensors',
          comfyVAE: 'qwen_image_vae.safetensors',
          comfyClipType: 'qwen_image',
          comfySteps: '30', comfyCfgScale: '4',
          comfyuisamplerName: 'euler_ancestral', comfyScheduler: 'simple'
        })
      },
      'DDUF文生图模板（MOSS-Image）': {
        workflow: jsonMossImage, builtin: true, note: 'DDUF文生图模板（MOSS-Image，50步 CFG3.5）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, {
          comfyModelFormat: 'DDUF',
          MODEL_NAME: 'moss_image_base_int8_convrot.safetensors',
          comfyTextEncoder: 'qwen3.5_9b_int8_convrot.safetensors',
          comfyVAE: 'flux2-vae.safetensors',
          comfyClipType: 'moss_image',
          comfySteps: '50', comfyCfgScale: '3.5',
          comfyuisamplerName: 'euler', comfyScheduler: 'simple'
        })
      },
      'DDUF图片编辑模板（Qwen-image-2.1）': {
        workflow: jsonQwen21, builtin: true, note: 'DDUF图片编辑模板（Qwen-image-2.1，编辑+生图一体，最多8张参考图）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "qwen_image_2.1_int8_convrot.safetensors",
    comfyTextEncoder: "qwen3vl_8b_int8_convrot.safetensors",
    comfyVAE: "qwen_image_2.1_vae_bf16.safetensors",
    comfyClipType: "qwen_image",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "25",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "none",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Qwen-image-2.1 Turbo）': {
        workflow: jsonQwen21Turbo, builtin: true, note: 'DDUF图片编辑模板（Qwen-image-2.1 Turbo，8步少步加速·编辑+生图一体，最多8张参考图）',
        snapshot: {
    comfyModelFormat: "DDUF",
    MODEL_NAME: "qwen_image_2.1_turbo_int8_convrot.safetensors",
    comfyTextEncoder: "qwen3vl_8b_int8_convrot.safetensors",
    comfyVAE: "qwen_image_2.1_vae_bf16.safetensors",
    comfyClipType: "qwen_image",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "8",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "none",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Qwen-image-2.1 Turbo·自定义 sigma）': {
        workflow: jsonQwen21TurboSigma, builtin: true, note: 'DDUF图片编辑模板（Qwen-image-2.1 Turbo，8步固定 sigma 网格（SamplerCustom+CustomSigmas·需KJNodes）·编辑+生图一体，最多8张参考图）',
        snapshot: {
    comfyModelFormat: "DDUF",
    MODEL_NAME: "qwen_image_2.1_turbo_int8_convrot.safetensors",
    comfyTextEncoder: "qwen3vl_8b_int8_convrot.safetensors",
    comfyVAE: "qwen_image_2.1_vae_bf16.safetensors",
    comfyClipType: "qwen_image",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "8",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "none",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Qwen-image-edit）': {
        workflow: jsonQwenEdit, builtin: true, note: 'DDUF图片编辑模板（Qwen-image-edit）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "Qwen-Image-Edit-2511-FP8.safetensors",
    comfyTextEncoder: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    comfyVAE: "qwen_image_vae.safetensors",
    comfyClipType: "qwen_image",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "4",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "Qwen-Image-2512-Lightning-4steps-V1.0-bf16.safetensors",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Flux3klein）': {
        workflow: jsonFlux3Klein, builtin: true, note: 'DDUF图片编辑模板（Flux3klein，蒸馏版 16 步）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "flux3_image_klein_sd_int8_convrot.safetensors",
    comfyTextEncoder: "qwen3vl_4b_int8_convrot.safetensors",
    comfyVAE: "flux2-vae.safetensors",
    comfyClipType: "flux3",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "16",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "none",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Flux2klein）': {
        workflow: jsonFluxKlein, builtin: true, note: 'DDUF图片编辑模板（Flux2klein）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "flux-2-klein-9b-fp8.safetensors",
    comfyTextEncoder: "qwen_3_8b_fp8mixed.safetensors",
    comfyVAE: "flux2-vae.safetensors",
    comfyClipType: "flux2",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "6",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "karras",
    comfyLora1: "none",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（FireRed）': {
        workflow: jsonFireRed, builtin: true, note: 'DDUF图片编辑模板（FireRed）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "FireRed-Image-Edit-1.1_fp8mixed_comfy.safetensors",
    comfyTextEncoder: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
    comfyVAE: "qwen_image_vae.safetensors",
    comfyClipType: "qwen_image",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "8",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler",
    comfyScheduler: "simple",
    comfyLora1: "FireRed-Image-Edit-Lightning-8steps-v1.0.safetensors",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'DDUF图片编辑模板（Krea2）': {
        workflow: jsonKrea2, builtin: true, note: 'DDUF图片编辑模板（Krea2）',
        snapshot: { 
    comfyModelFormat: "DDUF",
    MODEL_NAME: "krea2_turbo_fp8_scaled.safetensors",
    comfyTextEncoder: "qwen3vl_4b_fp8_scaled.safetensors",
    comfyVAE: "qwen_image_vae.safetensors",
    comfyClipType: "krea2",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "8",
    comfyCfgScale: "1",
    comfyuisamplerName: "euler_ancestral",
    comfyScheduler: "karras",
    comfyLora1: "krea2_identity_edit_v1_2.safetensors",
    comfyLora1ModelStrength: 1,
    comfyLora1ClipStrength: 1,
    comfyLora2: "none",
    comfyLora2ModelStrength: 1,
    comfyLora2ClipStrength: 1,
    comfyLora3: "none",
    comfyLora3ModelStrength: 1,
    comfyLora3ClipStrength: 1,
    comfyLora4: "none",
    comfyLora4ModelStrength: 1,
    comfyLora4ClipStrength: 1
 }
      },
      'Checkpoint类型文生图模板': {
        workflow: jsonCkpt, builtin: true, note: 'Checkpoint类型文生图模板（SDXL/AuraFlow系自适应）',
        snapshot: Object.assign({}, BUILTIN_COMFY_SNAPSHOT, { comfySteps: '20', comfyCfgScale: '1', comfyScheduler: 'karras' })
      },
      'Checkpoint 图片编辑模板（workflow_Qwen-Rapid-AIO）': {
        workflow: jsonRapidAIO, builtin: true, note: 'Checkpoint 图片编辑模板（workflow_Qwen-Rapid-AIO，Qwen-Rapid-AIO 空latent图像编辑）',
        snapshot: {
    comfyModelFormat: "Checkpoint",
    MODEL_NAME: "Qwen-Rapid-AIO-fp8.safetensors",
    comfyTextEncoder: "",
    comfyVAE: "",
    comfyClipType: "",
    comfyWidth: "832",
    comfyHeight: "1216",
    comfySteps: "4",
    comfyCfgScale: "1",
    comfyuisamplerName: "sa_solver",
    comfyScheduler: "beta",
    comfyLora1: "none", comfyLora1ModelStrength: 1, comfyLora1ClipStrength: 1,
    comfyLora2: "none", comfyLora2ModelStrength: 1, comfyLora2ClipStrength: 1,
    comfyLora3: "none", comfyLora3ModelStrength: 1, comfyLora3ClipStrength: 1,
    comfyLora4: "none", comfyLora4ModelStrength: 1, comfyLora4ClipStrength: 1
        }
      }
    };
  };

  // 内置云API预设（字段结构对齐插件：key/imageSize/cfg/asyncMode/images 随预设保存）
  const OTHER_API_DEFAULT_PRESETS = {
    '硅基流动': {
      url: 'https://api.siliconflow.cn/v1',
      model: '', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'flat', hiddenFields: ['cfg'],
      customBody: '// 扁平格式请求体书写说明\n// 一、请求体特点\n// 标准扁平格式：生成参数直接平铺在顶层，一次请求同步返回结果，无需轮询；\n// 带负面提示词 / 步数 / 引导系数 / 种子与参考图数组，参数较全。\n// \n// 二、适合的 API 类型\n// OpenAI 兼容的扁平请求接口（典型路径 /images/generations）：\n// 字段直接写在顶层、同步返回图片（URL 或 base64）的文生图 / 图生图接口。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  "model": "${model}",\n  "prompt": "${prompt}",\n  "negative_prompt": "${negative_prompt}",\n  "size": "${size}",\n  "steps": ${steps},\n  "guidance_scale": ${guidance},\n  "seed": ${seed},\n  "n": ${n},\n  "images": ${ref_images}\n}'
    },
    '火山引擎': {
      url: 'https://ark.cn-beijing.volces.com/api/v3',
      model: '', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'flat', hiddenFields: ['steps', 'guidanceScale', 'seed', 'cfg', 'negative_prompt'],
      customBody: '// 扁平格式请求体书写说明\n// 一、请求体特点\n// 扁平格式：参考图放在 image 字段，固定 response_format 为 url、关闭 watermark，\n// 只发送核心参数（模型 / 提示词 / 尺寸 / 数量 / 参考图），同步返回结果。\n// \n// 二、适合的 API 类型\n// 火山方舟（Ark）视觉生成接口：image 字段接收参考图、同步返回图片 URL，\n// 适用于 Seedream 等文生图 / 图生图模型。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  "model": "${model}",\n  "prompt": "${prompt}",\n  "size": "${size}",\n  "n": ${n},\n  "image": ${ref_images},\n  "response_format": "url",\n  "watermark": false\n}'
    },
    '腾讯云(TokenHub)': {
      url: 'https://tokenhub.tencentmaas.com/v1',
      model: '', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'simple', hiddenFields: ['steps', 'guidanceScale', 'seed', 'cfg', 'batchSize', 'negative_prompt'],
      customBody: '// 完整配置模式请求体书写说明（异步轮询）\n// 一、请求体特点\n// 完整配置模式：顶层为 url / headers / body / poll 四段结构；\n// body 是提交请求体，提交后返回任务 id，再按 poll 定义轮询查询，属异步任务流。\n// \n// 二、适合的 API 类型\n// 先提交、后轮询的异步生图接口：提交接口返回任务 id，查询接口凭 id 换取结果\n// （腾讯云 TokenHub 图像生成即此模式）。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  "url": "https://tokenhub.tencentmaas.com/v1/api/image/submit",\n  "headers": {},\n  "body": {\n    "model": "${model}",\n    "prompt": "${prompt}",\n    "size": "${size}",\n    "n": ${n}\n  },\n  "poll": {\n    "url": "https://tokenhub.tencentmaas.com/v1/api/image/query",\n    "method": "POST",\n    "body": {\n      "model": "${model}",\n      "id": "${task_id}"\n    }\n  }\n}'
    },
    '阿里云（千问AI）': {
      url: 'https://dashscope.aliyuncs.com/api/v1',
      model: 'qwen-image-2.0-pro-2026-06-22', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'dashscope', hiddenFields: ['steps', 'guidanceScale', 'seed', 'cfg'],
      customBody: "// 完整配置模式请求体书写说明（同步返回）\n// 一、请求体特点\n// 完整配置模式（url / headers / body）：body 用百炼多模态结构，\n// input.messages 内按 content 数组混排参考图与文字，parameters.size 用星号分隔；\n// 同步返回结果，无需轮询。\n// \n// 二、适合的 API 类型\n// 阿里云百炼 multimodal-generation 接口（qwen-image 系列）：\n// 图文混排输入（参考图 + 提示词）、一次请求同步返回图片。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  \"url\": \"https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation\",\n  \"headers\": {},\n  \"body\": {\n    \"model\": \"${model}\",\n    \"input\": {\n      \"messages\": [{\n        \"role\": \"user\",\n        \"content\": [\n          ${ref_images_dashscope}\n          {\"text\": \"${prompt}\"}\n        ]\n      }]\n    },\n    \"parameters\": {\n      \"size\": \"${size_star}\",\n      \"n\": ${n},\n      \"watermark\": false\n    }\n  }\n}"
    },
    '百度云(千帆)': {
      url: 'https://qianfan.baidubce.com/v2',
      model: '', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'qianfan', hiddenFields: ['cfg'],
      customBody: '// 完整配置模式请求体书写说明（同步返回）\n// 一、请求体特点\n// 完整配置模式（url / body）：请求体由 body 字段承载，同步返回结果，无需轮询。\n// \n// 二、适合的 API 类型\n// 百度千帆 v2 图像生成接口（/images/generations）：\n// 标准 JSON 提交、同步返回图片地址的文生图接口。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  "url": "https://qianfan.baidubce.com/v2/images/generations",\n  "body": {\n    "model": "${model}",\n    "prompt": "${prompt}",\n    "negative_prompt": "${negative_prompt}",\n    "size": "${size}",\n    "n": ${n}\n  }\n}'
    },
    '魔搭社区': {
      url: 'https://api-inference.modelscope.cn/v1',
      model: '', width: 1024, height: 1024,
      batchSize: 1, steps: 20, guidanceScale: 7.5, seed: 0,
      bodyFormat: 'simple', hiddenFields: ['steps', 'guidanceScale', 'cfg', 'seed'],
      customBody: '// 完整配置模式请求体书写说明（异步轮询）\n// 一、请求体特点\n// 完整配置模式 + poll 轮询：提交请求带异步模式头，返回任务 id 后按 id 轮询；\n// poll 内用 imagesField / statusField / successValues / failValues 定义结果与状态解析。\n// \n// 二、适合的 API 类型\n// ModelScope 异步图像生成接口：提交后凭 task id 轮询任务状态，\n// 成功时从 output_images 取图（GET 轮询 + 状态字段判定的异步接口）。\n// \n// 三、常用占位符（所有平台通用）\n// ${model} 模型   ${prompt} 提示词   ${negative_prompt} 负面提示词\n// ${size} 尺寸(1024x1024)   ${size_star} 尺寸(1024*1024)   ${n} 生成数量\n// ${steps} 步数   ${guidance} 引导系数   ${seed} 随机种子\n// ${ref_images} 参考图数组(JSON)   ${ref_images_dashscope} 百炼参考图片段   ${ref_images_api} images 字段片段\n// ${api_key} API Key   ${url} 接口地址   ${task_id} 轮询任务号(仅 poll 的 url/body 内可用)\n// 提示：可参考此格式书写请求体（整体结构照搬，字段按目标接口文档替换）。\n// ═══════════════════════════════════════════════════════════════\n{\n  "url": "https://api-inference.modelscope.cn/v1/images/generations",\n  "headers": {\n    "X-ModelScope-Async-Mode": "true"\n  },\n  "body": {\n    "model": "${model}",\n    "prompt": "${prompt}",\n    "size": "${size}",\n    "n": ${n},\n    "image_url": ${ref_images}\n  },\n  "poll": {\n    "url": "https://api-inference.modelscope.cn/v1/tasks/${task_id}",\n    "method": "GET",\n    "headers": {\n      "X-ModelScope-Task-Type": "image_generation"\n    },\n    "imagesField": "output_images",\n    "statusField": "task_status",\n    "successValues": ["SUCCEED", "SUCCEEDED", "succeed", "succeeded", "success"],\n    "failValues": ["FAILED", "failed", "error"]\n  }\n}'
    }
  };

  WB.presets.builtinOtherApiPresets = function () {
    const raw = JSON.parse(JSON.stringify(OTHER_API_DEFAULT_PRESETS));
    for (const p of Object.values(raw)) {
      p.key = p.key || '';
      p.imageSize = p.imageSize || (p.width + 'x' + p.height);
      p.cfg = (p.cfg === undefined) ? 4 : p.cfg;
      p.asyncMode = !!p.asyncMode;
      p.images = p.images || [];
      p.hiddenFields = p.hiddenFields || [];
    }
    return raw;
  };

  WB.presets.rawTemplates = { jsonCkpt, jsonDduf };
})();
