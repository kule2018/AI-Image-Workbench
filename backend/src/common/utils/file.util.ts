import { Request } from 'express';
import * as crypto from 'crypto';

// 备份包导入的请求体上限：备份 zip 会随生成图不断增长，普通接口沿用默认上限
export const IMPORT_BODY_LIMIT = 2 * 1024 * 1024 * 1024;

// 将任意文件名清洗为安全文件名（替换 Windows/Unix 非法字符）
export function safeName(name: string): string {
  return (String(name || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)) || 'file';
}

// 从 dataUrl 解析出 mime 与二进制
export function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

// 根据 mime 推断扩展名
export function extFromMime(mime: string, fallback = '.png'): string {
  if (mime.includes('jpeg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return fallback;
}

// 生成唯一图片文件名（时间戳 + 随机）
export function genImageName(ext: string): string {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    + '_' + crypto.randomBytes(3).toString('hex') + ext;
}

// 读取原始请求体（用于二进制上传，如备份 zip）
export function readRawBody(req: Request, limit = IMPORT_BODY_LIMIT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
