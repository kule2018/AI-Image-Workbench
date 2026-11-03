import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProxyService } from './proxy.service';

@Controller('api/proxy')
export class ProxyController {
  constructor(private readonly service: ProxyService) {}

  @Post()
  async proxy(@Body() cfg: any, @Res() res: Response) {
    if (!cfg?.url) return res.status(400).json({ error: '缺少 url' });
    const headers = Object.assign({}, cfg.headers || {});
    let bodyBuf: Buffer | null = null;
    if (cfg.bodyBase64 != null) {
      bodyBuf = Buffer.from(String(cfg.bodyBase64), 'base64');
    } else if (cfg.body != null) {
      bodyBuf = Buffer.isBuffer(cfg.body) ? cfg.body
        : Buffer.from(typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body), 'utf-8');
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
    }
    try {
      const r = await this.service.proxyRequest(cfg.url, cfg.method || 'GET', headers, bodyBuf);
      const ct = r.contentType || '';
      const isBinary = /^(image\/|application\/octet|application\/zip)/.test(ct);
      if (cfg.responseType === 'arraybuffer' || isBinary) {
        return res.json({
          status: r.status, contentType: ct, binary: true,
          base64: r.buffer.toString('base64'),
        });
      }
      return res.json({ status: r.status, contentType: ct, text: r.buffer.toString('utf-8') });
    } catch (e) {
      return res.status(502).json({ error: '代理请求失败: ' + e.message });
    }
  }
}
