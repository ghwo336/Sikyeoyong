import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { APP_ERRORS, AppError, type AppErrorCode, renderDragonLine } from '@sikyeoyong/shared';
import type { Response } from 'express';

/** Body of every error response (server-api.md "에러 형식"). */
export interface ErrorBody {
  readonly error: {
    readonly code: AppErrorCode;
    readonly message: string;
    readonly dragonLine?: string;
    readonly detail?: unknown;
  };
}

/**
 * Optional fields an AppError detail may carry for the response.
 * `dragonParams` fills `{max}`, `{resetAt}` (already formatted for display).
 * `public` is the only part of the detail sent to the client.
 */
interface AppErrorDetail {
  readonly dragonParams?: Readonly<Record<string, string>>;
  readonly public?: unknown;
  /** Raw chain revert (chain-and-pcl.md). Logged on the server, never sent to the client. */
  readonly chain?: unknown;
}

const STATUS_TO_CODE: Readonly<Record<number, AppErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

function asDetail(detail: unknown): AppErrorDetail {
  return detail !== null && typeof detail === 'object' ? detail : {};
}

/**
 * The one place that turns exceptions into HTTP responses. Status, message and
 * dragon line come from the shared APP_ERRORS table only. Stack traces, keys and
 * internal details never reach the client; only `detail.public` does.
 */
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { body, status } = this.toBody(exception);
    if (exception instanceof AppError) {
      const chain = asDetail(exception.detail).chain;
      if (chain !== undefined) {
        this.logger.warn(`${body.error.code} chain=${JSON.stringify(chain)}`);
      }
    }
    if (status >= 500) {
      this.logger.error(body.error.code, exception instanceof Error ? exception.stack : undefined);
    }
    res.status(status).json(body);
  }

  toBody(exception: unknown): { body: ErrorBody; status: number } {
    let code: AppErrorCode = 'INTERNAL';
    let detail: AppErrorDetail = {};
    if (exception instanceof AppError) {
      code = exception.code;
      detail = asDetail(exception.detail);
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // Other client errors (413 body too large, 415, 406) are the client's fault, not a 500.
      code =
        STATUS_TO_CODE[status] ??
        (status >= 400 && status < 500 ? 'VALIDATION_FAILED' : 'INTERNAL');
    }
    const spec = APP_ERRORS[code];
    let dragonLine: string | undefined;
    try {
      dragonLine = renderDragonLine(code, detail.dragonParams);
    } catch {
      dragonLine = undefined; // a missing param must not leak a raw "{max}"
    }
    const exposeDetail = spec.httpStatus < 500 && detail.public !== undefined;
    return {
      status: spec.httpStatus,
      body: {
        error: {
          code,
          message: spec.message,
          ...(dragonLine === undefined ? {} : { dragonLine }),
          ...(exposeDetail ? { detail: detail.public } : {}),
        },
      },
    };
  }
}
