import { Inject, Injectable } from '@nestjs/common';
import {
  type AmountRange,
  AppError,
  aokrwToString,
  isInRange,
  parseAokrw,
} from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { uuidv7 } from '../../common/ids.js';
import { UsersRepository } from './users.repository.js';

/** The user's own settings. Other modules read users only through this service. */
@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * dev-login only: the user for a local developer key, made on first use with the
   * profile's first 30-day limit (D-31). Ids are `dev-<key>`, never an OAuth user's.
   */
  ensureDevUser(key: string, nowMs: number = Date.now()): string {
    const id = `dev-${key}`;
    this.repo.ensure({
      id,
      nickname: key,
      myPeriodicLimitAokrw: aokrwToString(this.config.policy.myPeriodicLimit.initialAokrw),
      createdAt: nowMs,
    });
    return id;
  }

  /**
   * D-29: the user behind a Pouchi app wallet, made on the first login with the policy's
   * first 30-day limit (D-31). Pouchi gives no name, so the owner is "주인님" until one is set.
   */
  ensurePouchiUser(walletId: string, walletAddress: string, nowMs: number = Date.now()): string {
    return this.repo.ensurePouchiUser(walletId, walletAddress, {
      id: uuidv7(nowMs),
      nickname: '주인님',
      myPeriodicLimitAokrw: aokrwToString(this.config.policy.myPeriodicLimit.initialAokrw),
      createdAt: nowMs,
    });
  }

  /** The name the ID card shows for the owner (users.nickname). */
  getNickname(userId: string): string {
    const profile = this.repo.findProfile(userId);
    if (profile === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return profile.nickname;
  }

  /**
   * The owner's own 30-day limit in aokrw (D-31, server-side only). Rows from before D-31 hold
   * the old monthly budget as it was (migration 0009 cannot read the profile), so the value is
   * clamped into the profile range and down onto its step here.
   */
  getMyPeriodicLimitAokrw(userId: string): bigint {
    const stored = this.repo.findMyPeriodicLimit(userId);
    if (stored === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return clampToRange(this.config.policy.myPeriodicLimit, parseAokrw(stored));
  }

  /**
   * Where an order goes, as the confirm card says it ("회사(역삼동)"): the address
   * text, else the neighborhood, else '집' until the user sets one (user-flow 7).
   * Blank text counts as not set.
   */
  getDestination(userId: string): string {
    const a = this.repo.findAddress(userId);
    if (a === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    const text = a.text?.trim() ?? '';
    const dong = a.dong?.trim() ?? '';
    return text !== '' ? text : dong !== '' ? dong : '집';
  }

  /** The neighborhood of the default address (get_context), null when not set. */
  getAddressDong(userId: string): string | null {
    const dong = this.repo.findAddressDong(userId);
    if (dong === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return dong;
  }

  /**
   * The owner's 30-day limit after the button (PUT /agents/me/limits, D-31). The caller checks
   * re-auth; the amount must be one the owner may pick, else VALIDATION_FAILED.
   */
  setMyPeriodicLimit(userId: string, aokrw: bigint): void {
    if (!isInRange(this.config.policy.myPeriodicLimit, aokrw)) {
      throw new AppError('VALIDATION_FAILED', {
        public: { issues: [{ path: 'myPeriodicLimit', message: 'out of range or off step' }] },
      });
    }
    if (this.repo.findProfile(userId) === undefined)
      throw new AppError('NOT_FOUND', { reason: 'user not found' });
    this.repo.setMyPeriodicLimit(userId, aokrwToString(aokrw));
  }
}

/** Into [min, max] and down onto a step (D-31): an old row never reads as a value the owner cannot pick. */
export function clampToRange(range: AmountRange, aokrw: bigint): bigint {
  if (aokrw <= range.minAokrw) return range.minAokrw;
  if (aokrw >= range.maxAokrw) return range.maxAokrw;
  return range.minAokrw + ((aokrw - range.minAokrw) / range.stepAokrw) * range.stepAokrw;
}
