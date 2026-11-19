import { Injectable } from '@nestjs/common';

export interface Liveness {
  readonly status: 'ok';
}

/** Process liveness only. Chain, MAWS and indexer checks belong to GET /api/admin/health. */
@Injectable()
export class HealthService {
  liveness(): Liveness {
    return { status: 'ok' };
  }
}
