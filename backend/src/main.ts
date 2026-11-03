import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ensureDirs } from './common/paths';
import * as express from 'express';

async function bootstrap() {
  ensureDirs();

  // 关闭 Nest 默认 body 解析，改为手动挂载：普通接口走 JSON（大上限），
  // 备份包导入（application/zip）不被 JSON 解析，由控制器以原始流读取。
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(express.json({ limit: '2100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2100mb' }));

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AI 图片工作台后端已启动: http://localhost:${port}`);
}

bootstrap();
