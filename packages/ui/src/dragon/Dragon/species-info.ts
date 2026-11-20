import type { DragonSpecies } from '@sikyeoyong/shared';

/**
 * Name and catchphrase per species (design/tokens.json dragonSpecies name and line, D-20).
 * The egg picker, the Look screen and the Wallet "용이 모습" row read it.
 */
export const SPECIES_INFO: Readonly<Record<DragonSpecies, { name: string; line: string }>> = {
  forest: { name: '숲용', line: '천천히 먹어용' },
  water: { name: '물용', line: '국물이 최고예용' },
  flower: { name: '꽃용', line: '오늘도 수고했어용' },
  star: { name: '별용', line: '야식은 반만 먹어용' },
};
