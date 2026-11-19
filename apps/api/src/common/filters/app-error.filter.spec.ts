import 'reflect-metadata';
import type { Server } from 'node:http';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppError } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { configureApp } from '../../app.setup.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { AppErrorFilter, type ErrorBody } from './app-error.filter.js';

function errorOf(res: { body: unknown }): ErrorBody['error'] {
  return (res.body as ErrorBody).error;
}

const SECRET = 'sk-internal-should-never-leak';
const Echo = z.object({ qty: z.number().int().min(1), note: z.string().max(5) });

@Controller('t')
class TestController {
  @Get('limit')
  limit(): never {
    throw new AppError('CHAIN_AGENT_LIMIT', {
      dragonParams: { max: '10,000원' },
      public: { maxAokrw: '10000000000000000000000' },
      chain: 'raw revert data',
    });
  }

  @Get('limit-missing-param')
  limitMissing(): never {
    throw new AppError('CHAIN_AGENT_LIMIT');
  }

  @Get('internal')
  internal(): never {
    throw new AppError('INTERNAL', { public: { key: SECRET } });
  }

  @Get('crash')
  crash(): never {
    throw new Error(SECRET);
  }

  @Get('nest-forbidden')
  forbidden(): never {
    throw new ForbiddenException(SECRET);
  }

  @Post('echo')
  echo(@Body(new ZodValidationPipe(Echo)) body: z.infer<typeof Echo>): z.infer<typeof Echo> {
    return body;
  }
}

describe('AppErrorFilter (server-api.md error format)', () => {
  let app: INestApplication;
  let http: () => Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [TestController] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = () => app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps an AppError to its status, message, dragon line and public detail only', async () => {
    const res = await request(http()).get('/api/t/limit');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'CHAIN_AGENT_LIMIT',
        message: '건당 한도를 넘었어요',
        dragonLine: '한 번에 10,000원까지만 쓸 수 있어용. 주인님 허락받아 올게용!',
        detail: { maxAokrw: '10000000000000000000000' },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('raw revert data');
  });

  it('drops the dragon line instead of leaking a raw placeholder', async () => {
    const res = await request(http()).get('/api/t/limit-missing-param');
    expect(res.status).toBe(422);
    expect(errorOf(res).dragonLine).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('{max}');
  });

  it('never exposes detail for 5xx codes', async () => {
    const res = await request(http()).get('/api/t/internal');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL',
        message: '잠시 후 다시 시도해 주세요',
        dragonLine: '앗, 뭔가 꼬였어용',
      },
    });
  });

  it('turns unknown errors into INTERNAL without message or stack', async () => {
    const res = await request(http()).get('/api/t/crash');
    expect(res.status).toBe(500);
    expect(errorOf(res).code).toBe('INTERNAL');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('maps Nest HTTP exceptions to AppErrorCode without their message', async () => {
    const res = await request(http()).get('/api/t/nest-forbidden');
    expect(res.status).toBe(403);
    expect(errorOf(res).code).toBe('FORBIDDEN');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('answers unknown routes with NOT_FOUND', async () => {
    const res = await request(http()).post('/api/nope');
    expect(res.status).toBe(404);
    expect(errorOf(res).code).toBe('NOT_FOUND');
  });
});

describe('ZodValidationPipe', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [TestController] }).compile();
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

describe('AppErrorFilter.toBody', () => {
  const filter = new AppErrorFilter();

  it('maps every Nest status it knows and falls back to INTERNAL', () => {
    expect(filter.toBody(new ForbiddenException()).body.error.code).toBe('FORBIDDEN');
    expect(filter.toBody('a string').body.error.code).toBe('INTERNAL');
    expect(filter.toBody(undefined).status).toBe(500);
  });
});
