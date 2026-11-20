import type { KeyboardEvent } from 'react';

/**
 * Keyboard rules for a group of role="radio" buttons (WAI-ARIA radio group):
 * Tab enters the group once, on the checked item (or the first); arrow keys move,
 * wrap around and select as they go; Home and End jump to the ends.
 * Used through ChoiceGroup (TasteRating, EggPicker).
 */
export function radioTabIndex(index: number, selectedIndex: number): 0 | -1 {
  const entry = selectedIndex >= 0 ? selectedIndex : 0;
  return index === entry ? 0 : -1;
}

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const PREV = new Set(['ArrowLeft', 'ArrowUp']);

/** onKeyDown for the radiogroup element. `onSelect` gets the new index. */
export function radioGroupKeyDown(onSelect: (index: number) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    // Alt+Arrow is browser back, Cmd/Ctrl+Arrow jumps text: leave those alone.
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const n = radios.length;
    if (n === 0) return;
    const current = radios.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (NEXT.has(e.key)) next = ((current < 0 ? -1 : current) + 1) % n;
    else if (PREV.has(e.key)) next = ((current < 0 ? 0 : current) - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    radios[next]?.focus();
    onSelect(next);
  };
}
