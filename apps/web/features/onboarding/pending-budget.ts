/**
 * The sign-up budget step (Budget.dc.html) is shown once, right after the dragon hatches.
 * Hatch leaves a mark here and the step clears it; an onboarded owner opening /budget later
 * has no mark and is sent to the dragon screen (browser QA 3). Browser storage can be missing
 * (private window), then the step is simply not offered again.
 */
const KEY = 'sikyeoyong.signup-budget-pending';

export function markBudgetStepPending(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // No storage: nothing to remember.
  }
}

export function isBudgetStepPending(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearBudgetStepPending(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // No storage: nothing to clear.
  }
}
