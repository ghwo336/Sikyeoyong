import 'reflect-metadata';
import type { Server } from 'node:http';
import { Body, Controller, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { configureApp } from '../../app.setup.js';
import type { ErrorBody } from '../filters/app-error.filter.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const Echo = z.object({ qty: z.number().int().min(1), note: z.string().max(5) });

@Controller('t')
class EchoController {
  @Post('echo')
  echo(@Body(new ZodValidationPipe(Echo)) body: z.infer<typeof Echo>): z.infer<typeof Echo> {
    return body;
  }
}

function errorOf(res: { body: unknown }): ErrorBody['error'] {
  return (res.body as ErrorBody).error;
}

describe('ZodValidationPipe', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [EchoController] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('passes valid input through', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/api/t/echo')
      .send({ qty: 2, note: 'hi' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ qty: 2, note: 'hi' });
  });

  it('answers 400 VALIDATION_FAILED with paths, never the input values', async () => {
    const res = await request(app.getHttpServer() as Server)
      .post('/api/t/echo')
      .send({ qty: 0, note: 'secret-note-value' });
    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_FAILED');
    const paths = (errorOf(res).detail as { issues: { path: string }[] }).issues
      .map((i) => i.path)
      .sort();
    expect(paths).toEqual(['note', 'qty']);
    expect(JSON.stringify(res.body)).not.toContain('secret-note-value');
  });

  it('rejects a missing body', async () => {
    const res = await request(app.getHttpServer() as Server).post('/api/t/echo');
    expect(res.status).toBe(400);
    expect(errorOf(res).code).toBe('VALIDATION_FAILED');
  });
});
