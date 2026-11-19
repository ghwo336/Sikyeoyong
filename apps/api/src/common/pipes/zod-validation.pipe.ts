import { type PipeTransform } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import type { z } from 'zod';

/**
 * Validates body, query or params with a shared zod schema (server-api.md).
 * Failure is VALIDATION_FAILED (400) with paths and messages only, never the
 * input values.
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError('VALIDATION_FAILED', {
        public: {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
      });
    }
    return result.data;
  }
}
