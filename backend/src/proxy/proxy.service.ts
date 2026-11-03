import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

@Injectable()
export class ProxyService {
  proxyRequest(
    target: string,
    method: string,
    headers: Record<string, any>,
    bodyBuf: Buffer | null,
  ): Promise<{ status: number; contentType: string; buffer: Buffer }> {
    return new Promise((resolve, reject) => {
      let u: URL;
      try { u = new URL(target); } catch (e) { return reject(new Error('无效 URL')); }
      const isHttps = u.protocol === 'https:';
      const mod = isHttps ? https : http;

      // 转发头：剥离由本代理控制/会随 body 变化的头，避免长度错配导致目标读取字节异常
      // （尤其 bodyBase64 的二进制/ multipart 上传：实际 body 是解码后的二进制，原 content-length 是 JSON 包长度）
      const fwdHeaders: Record<string, any> = Object.assign({}, headers || {});
      for (const k of ['content-length', 'Content-Length', 'transfer-encoding', 'Transfer-Encoding', 'connection', 'Connection']) {
        delete fwdHeaders[k];
      }
      fwdHeaders['host'] = u.host;
      if (bodyBuf && bodyBuf.length) fwdHeaders['Content-Length'] = String(bodyBuf.length);

      const req = mod.request({
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: method || 'GET',
        headers: fwdHeaders,
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          contentType: (res.headers['content-type'] as string) || '',
          buffer: Buffer.concat(chunks),
        }));
      });
      req.on('error', reject);
      req.setTimeout(600000, () => { req.destroy(new Error('代理请求超时')); });
      if (bodyBuf && bodyBuf.length) req.write(bodyBuf);
      req.end();
    });
  }
}
