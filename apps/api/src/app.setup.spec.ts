import 'reflect-metadata';
import { Controller, Get, Module, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { API_SECURITY_HEADERS, configureApp } from './app.setup.js';

@Module({})
class Empty {}

describe('configureApp trust proxy (per-IP limits, tech-spec 9.5)', () => {
  let close: () => Promise<void> = () => Promise.resolve();
  afterAll(() => close());

  it('believes X-Forwarded-For only from loopback and private networks, never from the internet', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [Empty] }).compile();
    const app = configureApp(moduleRef.createNestApplication());
    await app.init();
    close = () => app.close();
    const express = app.getHttpAdapter().getInstance() as { get(k: string): unknown };
    const trust = express.get('trust proxy fn') as (addr: string, i: number) => boolean;
    expect(trust('127.0.0.1', 0)).toBe(true); // Next dev proxy
    expect(trust('172.18.0.3', 0)).toBe(true); // Caddy on the docker network
    expect(trust('10.0.0.5', 0)).toBe(true);
    expect(trust('203.0.113.7', 0)).toBe(false); // a client that sends its own header
    expect(trust('8.8.8.8', 0)).toBe(false);
  });
});

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
  @Get('missing')
  missing() {
    throw new NotFoundException();
  }
}
@Module({ controllers: [PingController] })
class WithPing {}

describe('configureApp security headers (QA 4)', () => {
  let close: () => Promise<void> = () => Promise.resolve();
  afterAll(() => close());

  it('sends the web headers on ok answers, errors and unknown paths', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WithPing] }).compile();
    const app = configureApp(moduleRef.createNestApplication());
    await app.init();
    close = () => app.close();
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    for (const [path, status] of [
      ['/api/ping', 200],
      ['/api/ping/missing', 404],
      ['/nowhere', 404],
    ] as const) {
      const res = await request(server).get(path);
      expect(res.status).toBe(status);
      for (const [k, v] of Object.entries(API_SECURITY_HEADERS)) {
        expect(res.headers[k.toLowerCase()]).toBe(v);
      }
    }
    expect(API_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(API_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });
});
