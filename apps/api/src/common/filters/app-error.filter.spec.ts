import 'reflect-metadata';
import type { Server } from 'node:http';
import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  type INestApplication,
  InternalServerErrorException,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppError } from '@sikyeoyong/shared';
import request from 'supertest';
import { Logger } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { AppErrorFilter, type ErrorBody } from './app-error.filter.js';

function errorOf(res: { body: unknown }): ErrorBody['error'] {
  return (res.body as ErrorBody).error;
}

const SECRET = 'sk-internal-should-never-leak';

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

  it('logs the raw chain revert on the server but never sends it', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const res = await request(http()).get('/api/t/limit');
    expect(JSON.stringify(res.body)).not.toContain('raw revert data');
    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('CHAIN_AGENT_LIMIT');
    expect(logged).toContain('raw revert data');
    warn.mockRestore();
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
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL',
        message: '잠시 후 다시 시도해 주세요',
        dragonLine: '앗, 뭔가 꼬였어용',
      },
    });
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

describe('AppErrorFilter.toBody: Nest HTTP exceptions', () => {
  const filter = new AppErrorFilter();

  // Expected values written by hand from server-api.md, not read from the filter's table.
  it.each([
    [new BadRequestException(), 'VALIDATION_FAILED', 400],
    [new UnauthorizedException(), 'UNAUTHENTICATED', 401],
    [new ForbiddenException(), 'FORBIDDEN', 403],
    [new NotFoundException(), 'NOT_FOUND', 404],
    [new MethodNotAllowedException(), 'NOT_FOUND', 404],
    [new ConflictException(), 'CONFLICT', 409],
    [new HttpException('x', 429), 'RATE_LIMITED', 429],
    [new PayloadTooLargeException(), 'VALIDATION_FAILED', 400],
    [new UnsupportedMediaTypeException(), 'VALIDATION_FAILED', 400],
    [new HttpException('x', 503), 'INTERNAL', 500],
    [new InternalServerErrorException(), 'INTERNAL', 500],
  ] as const)('%s -> %s %s', (exception, code, status) => {
    const out = filter.toBody(exception);
    expect(out.body.error.code).toBe(code);
    expect(out.status).toBe(status);
  });

  it('falls back to INTERNAL for non-errors', () => {
    expect(filter.toBody('a string').body.error.code).toBe('INTERNAL');
    expect(filter.toBody(undefined).status).toBe(500);
  });
});
