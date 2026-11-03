import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Socket } from 'net';

// ComfyUI 采样预览的 WebSocket 代理：浏览器 → 本后端 → ComfyUI。
// 仅做字节级双向 pipe，不解帧、不改内容（WebSocket 帧对中间人透明）。
@Injectable()
export class ComfyWsService implements OnModuleInit {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer() as http.Server;
    server.on('upgrade', (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
      let u: URL;
      try { u = new URL(req.url || '', 'http://localhost'); } catch (e) { return socket.destroy(); }
      if (u.pathname !== '/api/comfy-ws') return socket.destroy();

      const target = u.searchParams.get('target');
      let t: URL;
      try { t = new URL(target || ''); } catch (e) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        return socket.destroy();
      }
      const isHttps = t.protocol === 'https:' || t.protocol === 'wss:';
      const mod = isHttps ? https : http;
      const port = t.port || (isHttps ? 443 : 80);

      const headers = Object.assign({}, req.headers, {
        host: t.host,
        origin: (isHttps ? 'https://' : 'http://') + t.host,
      });
      const upReq = mod.request({
        hostname: t.hostname, port, path: t.pathname + t.search,
        method: 'GET', headers,
      });

      upReq.on('upgrade', (upRes: http.IncomingMessage, upSocket: Socket, upHead: Buffer) => {
        socket.write('HTTP/1.1 ' + upRes.statusCode + ' ' + (upRes.statusMessage || 'Switching Protocols') + '\r\n');
        for (let i = 0; i < upRes.rawHeaders.length; i += 2) {
          socket.write(upRes.rawHeaders[i] + ': ' + upRes.rawHeaders[i + 1] + '\r\n');
        }
        socket.write('\r\n');
        if (upHead && upHead.length) socket.write(upHead);
        if (head && head.length) upSocket.write(head);

        const halfClose = (sock: Socket, peer?: Socket) => {
          try { if (!sock.destroyed && !sock.writableEnded) sock.end(); } catch (e) { /* 忽略 */ }
          try { if (peer && !peer.destroyed && !peer.writableEnded) peer.end(); } catch (e) { /* 忽略 */ }
          const tm = setTimeout(() => {
            try { if (!sock.destroyed) sock.destroy(); } catch (e) { /* 忽略 */ }
            try { if (peer && !peer.destroyed) peer.destroy(); } catch (e) { /* 忽略 */ }
          }, 2000);
          if (tm.unref) tm.unref();
        };
        const tearDown = () => halfClose(socket, upSocket);
        upSocket.on('data', (d) => { if (!socket.destroyed) socket.write(d); });
        socket.on('data', (d) => { if (!upSocket.destroyed) upSocket.write(d); });
        upSocket.on('close', tearDown);
        upSocket.on('error', tearDown);
        socket.on('close', () => { try { if (!upSocket.destroyed) upSocket.end(); } catch (e) { /* 忽略 */ } });
        socket.on('error', tearDown);
      });

      upReq.on('response', (res2: http.IncomingMessage) => {
        socket.write('HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n'
          + 'WS 代理失败：目标返回 ' + res2.statusCode);
        socket.destroy();
      });
      upReq.on('error', () => { try { socket.destroy(); } catch (e) {} });
      upReq.end();
    });
  }
}
