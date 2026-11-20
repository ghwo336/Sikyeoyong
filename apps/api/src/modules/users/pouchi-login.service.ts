import { Injectable } from '@nestjs/common';
import type { PouchiCompleteBody } from '@sikyeoyong/shared';
import { AuthService } from '../auth/auth.service.js';
import { PouchiService } from '../pouchi/pouchi.service.js';
import { UsersService } from './users.service.js';

/**
 * D-29: a checked Pouchi result becomes a 시켜용 session. The wallet id is the identity; the
 * first login makes the user. The previous session (if any) is revoked by AuthService.rotate,
 * as every login route does (auth.md).
 */
@Injectable()
export class PouchiLoginService {
  constructor(
    private readonly pouchi: PouchiService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async complete(body: PouchiCompleteBody, previousSid: string | null): Promise<string> {
    const wallet = await this.pouchi.complete({
      envelope: body.envelope,
      codeVerifier: body.codeVerifier,
      requestId: body.requestId,
    });
    const userId = this.users.ensurePouchiUser(wallet.walletId, wallet.walletAddress);
    return this.auth.rotate(previousSid, userId, 'web');
  }
}
