import { Inject, Injectable } from '@nestjs/common';
import {
  aokrwToString,
  kstMonthOf,
  type PaymentProvider,
  type WalletView,
} from '@sikyeoyong/shared';
import { AgentsService } from '../agents/agents.service.js';
import { AllowanceService } from '../allowance/allowance.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { UsersService } from '../users/users.service.js';

/**
 * The wallet screen's money (GET /api/wallet, Wallet.dc.html).
 * - owner: the owner allowance ledger while custodial (D-24, allowance module).
 * - pocket: what the dragon's wallet holds on chain now (0 before hatching wrote a wallet).
 * - savedThisMonth: this month's personal budget minus what was spent, never below zero
 *   (default reading of "이번 달 아낀 돈", open-questions Q-37).
 */
@Injectable()
export class WalletService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly agents: AgentsService,
    private readonly allowance: AllowanceService,
    private readonly orders: OrdersService,
    private readonly users: UsersService,
  ) {}

  async getView(userId: string, nowMs: number = Date.now()): Promise<WalletView> {
    const agent = this.agents.getForUser(userId);
    const pocket = agent.wallet === null ? 0n : await this.payment.balanceOf(agent.wallet);
    const owner = this.allowance.balanceAokrw(userId);
    const budget = this.users.getMonthlyBudgetAokrw(userId);
    const spent = this.orders.spentInMonthAokrw(userId, kstMonthOf(nowMs));
    return {
      owner: aokrwToString(owner > 0n ? owner : 0n),
      pocket: aokrwToString(pocket),
      savedThisMonth: aokrwToString(budget > spent ? budget - spent : 0n),
    };
  }
}
