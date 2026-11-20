import { Controller, Get, UseGuards } from '@nestjs/common';
import type { WalletView } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { WalletService } from './wallet.service.js';

/** GET /api/wallet (Wallet.dc.html). The user is the session's. */
@Controller('wallet')
@UseGuards(SessionGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): Promise<WalletView> {
    return this.wallet.getView(user.userId);
  }
}
