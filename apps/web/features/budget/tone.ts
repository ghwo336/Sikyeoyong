import type { NagStage } from '@sikyeoyong/shared';
import type { MeterTone } from '@sikyeoyong/ui';

/** Meter paints what the server judged (nagLevel); the web never compares amounts itself. */
export const BUDGET_TONE: { readonly [S in NagStage]: MeterTone } = {
  none: 'normal',
  warn70: 'warn',
  warn90: 'warn',
  over100: 'over',
};
