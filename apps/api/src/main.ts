import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { API_PREFIX } from './app.constants.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  // Port comes from the env config module in the next step; 8787 is the tech-spec 8.3 default.
  await app.listen(8787);
}

void bootstrap();
