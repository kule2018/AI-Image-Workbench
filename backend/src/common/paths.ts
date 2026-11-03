import * as path from 'path';
import * as fs from 'fs';

function resolveEnv(key: string, fallback: string): string {
  const v = process.env[key];
  if (!v) return fallback;
  return path.isAbsolute(v) ? v : path.resolve(process.cwd(), v);
}

const root = process.cwd();
const dataDir = resolveEnv('DATA_DIR', path.join(root, 'data'));
const outputDir = resolveEnv('OUTPUT_DIR', path.join(root, 'output'));

export const DIRS = {
  data: dataDir,
  output: outputDir,
  imported: path.join(outputDir, 'imported'),   // 备份包导入的缓存图片
  library: path.join(dataDir, 'library'),        // 素材库
  canvases: path.join(dataDir, 'canvases'),      // 画布
};

export function ensureDirs(): void {
  [DIRS.data, DIRS.output, DIRS.imported, DIRS.library, DIRS.canvases].forEach((d) => {
    try { fs.mkdirSync(d, { recursive: true }); } catch (e) { /* 已存在 */ }
  });
}
