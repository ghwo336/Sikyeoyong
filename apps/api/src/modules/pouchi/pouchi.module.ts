import { Module } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { POUCHI_BRIDGE, type PouchiBridge } from './pouchi-bridge.js';
import { PouchiService } from './pouchi.service.js';
import { SdkPouchiBridge } from './sdk-pouchi-bridge.js';

/** Pouchi login off (POUCHI_API_URL unset): every completion is refused, nothing is called. */
const off: PouchiBridge = {
  complete: () => Promise.reject(new AppError('INTERNAL', { reason: 'pouchi login is off' })),
};

/** The Pouchi login bridge (D-29). Users import this module to log people in. */
@Module({
  imports: [RateLimitModule],
  providers: [
    {
      provide: POUCHI_BRIDGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): PouchiBridge => {
        const p = config.pouchi;
        const appKey = config.secrets.pouchiAppKey;
        if (p === undefined || appKey === undefined) return off;
        return new SdkPouchiBridge({ ...p, appKey, chainId: config.chain.chainId });
      },
    },
    PouchiService,
  ],
  exports: [PouchiService],
})
export class PouchiModule {}
