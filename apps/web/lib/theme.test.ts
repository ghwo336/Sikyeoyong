import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applySpecies,
  bootSpecies,
  DEFAULT_SPECIES,
  SPECIES_STORAGE_KEY,
  shownSpecies,
  THEME_BOOT_SCRIPT,
} from './theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.species;
});

describe('theme (D-32)', () => {
  it('shows forest when <html> has no species or an unknown one', () => {
    expect(DEFAULT_SPECIES).toBe('forest');
    expect(shownSpecies()).toBe('forest');
    document.documentElement.dataset.species = 'dragonfruit';
    expect(shownSpecies()).toBe('forest');
  });

  it('applySpecies paints <html> and remembers it; a preview does not remember', () => {
    applySpecies('flower', { remember: false });
    expect(document.documentElement.dataset.species).toBe('flower');
    expect(shownSpecies()).toBe('flower');
    expect(localStorage.getItem(SPECIES_STORAGE_KEY)).toBeNull();
    applySpecies('star');
    expect(localStorage.getItem(SPECIES_STORAGE_KEY)).toBe('star');
  });

  it('the boot step sets a remembered species before paint, and ignores anything else', () => {
    localStorage.setItem(SPECIES_STORAGE_KEY, 'water');
    bootSpecies(SPECIES_STORAGE_KEY, DRAGON_SPECIES);
    expect(document.documentElement.dataset.species).toBe('water');
    delete document.documentElement.dataset.species;
    localStorage.setItem(SPECIES_STORAGE_KEY, '"><script>');
    bootSpecies(SPECIES_STORAGE_KEY, DRAGON_SPECIES);
    expect(document.documentElement.dataset.species).toBeUndefined();
  });

  it('the inline script calls that step with the storage key and the species list', () => {
    expect(THEME_BOOT_SCRIPT.startsWith('(function bootSpecies')).toBe(true);
    expect(THEME_BOOT_SCRIPT).toContain(
      `)("${SPECIES_STORAGE_KEY}", ${JSON.stringify(DRAGON_SPECIES)});`,
    );
  });
});
