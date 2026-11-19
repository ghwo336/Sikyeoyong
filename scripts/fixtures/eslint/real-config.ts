// Fixture for scripts/eslint-boundaries.test.mjs: linted with the real config
// (type-aware rules on). Each line below must trigger the rule named after it.
async function work(): Promise<number> {
  await Promise.resolve();
  return 1;
}

export function run(): void {
  work(); // @typescript-eslint/no-floating-promises
}

export const text = `${{ a: 1 }.a}${String([1])}${[] as unknown as string}`;
export const loose: any = 1; // @typescript-eslint/no-explicit-any
