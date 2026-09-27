import { describe, it, expect } from 'vitest';
import { relativIdo, ESEMENY_CIMKE } from './ertesites';

describe('relativIdo', () => {
  const most = new Date('2026-09-27T12:00:00Z');
  it('perc/óra/nap pontossággal', () => {
    expect(relativIdo('2026-09-27T11:59:30Z', most)).toBe('most');
    expect(relativIdo('2026-09-27T11:55:00Z', most)).toBe('5 perce');
    expect(relativIdo('2026-09-27T10:00:00Z', most)).toBe('2 órája');
    expect(relativIdo('2026-09-26T12:00:00Z', most)).toBe('tegnap');
    expect(relativIdo('2026-09-24T12:00:00Z', most)).toBe('3 napja');
  });
  it('minden eseménynek van kiírt felirata', () => {
    expect(Object.values(ESEMENY_CIMKE).every((c) => c.length > 0)).toBe(true);
  });
});
