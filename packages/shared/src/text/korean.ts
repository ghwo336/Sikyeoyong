/**
 * "3으로", "2로": a number followed by the particle 로 or 으로, chosen by how the number
 * is read in Korean (일, 이, 삼, ...). Used for levels ("레벨 3으로 올리고 시키기").
 */
export function levelWithRo(level: number): string {
  // 0 ends in 십, 백, 천 or 영 (all with a final consonant); 3 삼 and 6 육 too.
  // 1 일, 7 칠, 8 팔 end in ㄹ, which takes 로.
  const last = Math.abs(Math.trunc(level)) % 10;
  return `${String(level)}${[0, 3, 6].includes(last) ? '으로' : '로'}`;
}
