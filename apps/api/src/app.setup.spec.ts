import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { configureApp } from './app.setup.js';

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
