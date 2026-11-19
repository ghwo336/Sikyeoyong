import { Global, Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter.js';

/** One limiter for the process, shared by every module that limits something. */
@Global()
@Module({ providers: [RateLimiter], exports: [RateLimiter] })
export class RateLimitModule {}
