import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_PREFIX } from '../../app.constants.js';
import { AppModule } from '../../app.module.js';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with status ok under the /api prefix', async () => {
    const res = await request(app.getHttpServer() as Server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('is not served without the prefix', async () => {
    const res = await request(app.getHttpServer() as Server).get('/health');
    expect(res.status).toBe(404);
  });
});
