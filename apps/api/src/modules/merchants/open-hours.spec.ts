import { describe, expect, it } from 'vitest';
import { isOpenAt } from './open-hours.js';

// KST wall clock to unix ms. 2026-12-10 is a Thursday, 2026-12-13 a Sunday, 2026-12-14 a Monday.
const kst = (iso: string) => Date.parse(`${iso}+09:00`);

describe('isOpenAt (tech-spec 7.1 openHours, KST)', () => {
  it.each([
    ['inside a daytime span', { 'mon-sun': '10:00-22:00' }, '2026-12-10T12:28:00', true],
    ['at the opening minute', { 'mon-sun': '10:00-22:00' }, '2026-12-10T10:00:00', true],
    ['at the closing minute', { 'mon-sun': '10:00-22:00' }, '2026-12-10T22:00:00', false],
    ['before opening', { 'mon-sun': '10:00-22:00' }, '2026-12-10T09:59:00', false],
    ['weekday-only shop on Sunday', { 'mon-fri': '08:00-20:00' }, '2026-12-13T12:00:00', false],
    ['weekday-only shop on Monday', { 'mon-fri': '08:00-20:00' }, '2026-12-14T12:00:00', true],
    ['all day with 24:00', { 'mon-sun': '00:00-24:00' }, '2026-12-10T23:59:00', true],
    ['overnight span after start', { 'mon-sun': '15:00-02:00' }, '2026-12-10T23:00:00', true],
    ['overnight span after midnight', { 'mon-sun': '15:00-02:00' }, '2026-12-11T01:30:00', true],
    ['overnight span past its end', { 'mon-sun': '15:00-02:00' }, '2026-12-11T02:00:00', false],
    ['overnight from Friday into Saturday', { fri: '20:00-02:00' }, '2026-12-12T01:00:00', true],
    ['overnight from Friday, Sunday night', { fri: '20:00-02:00' }, '2026-12-14T01:00:00', false],
    ['wrapping day range', { 'fri-mon': '10:00-12:00' }, '2026-12-13T11:00:00', true],
    ['wrapping day range, Thursday', { 'fri-mon': '10:00-12:00' }, '2026-12-10T11:00:00', false],
  ])('%s', (_name, hours, at, open) => {
    expect(isOpenAt(hours, kst(at))).toBe(open);
  });

  it.each([
    ['no hours', {}],
    ['unknown day key', { everyday: '00:00-24:00' }],
    ['broken span', { 'mon-sun': '10-22' }],
    ['same start and end', { 'mon-sun': '10:00-10:00' }],
    ['minute past 24:00', { 'mon-sun': '00:00-24:30' }],
  ])('counts %s as closed', (_name, hours) => {
    expect(isOpenAt(hours, kst('2026-12-10T12:00:00'))).toBe(false);
  });
});
