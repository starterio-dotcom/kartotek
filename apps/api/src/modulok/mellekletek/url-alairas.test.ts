import { describe, it, expect } from 'vitest';
import { alairtTartalomUtvonal, ervenyesAlairas } from './url-alairas.js';

describe('melléklet URL-aláírás', () => {
  const id = '6a361cbfcd7a8c01b48b8610';
  const v = 2;
  const mid = 'm_abc';

  function felbont(url: string): { exp: number; sig: string } {
    const q = new URLSearchParams(url.split('?')[1]);
    return { exp: Number(q.get('exp')), sig: q.get('sig')! };
  }

  it('érvényes aláírást generál és fogad el', () => {
    const { exp, sig } = felbont(alairtTartalomUtvonal(id, v, mid));
    expect(ervenyesAlairas(id, v, mid, exp, sig)).toBe(true);
  });

  it('manipulált aláírást elutasít', () => {
    const { exp } = felbont(alairtTartalomUtvonal(id, v, mid));
    expect(ervenyesAlairas(id, v, mid, exp, 'deadbeef')).toBe(false);
  });

  it('más elem/mid/verzió aláírását elutasítja', () => {
    const { exp, sig } = felbont(alairtTartalomUtvonal(id, v, mid));
    expect(ervenyesAlairas(id, v, 'm_masik', exp, sig)).toBe(false);
    expect(ervenyesAlairas('masikId', v, mid, exp, sig)).toBe(false);
    expect(ervenyesAlairas(id, 9, mid, exp, sig)).toBe(false);
  });

  it('lejárt aláírást elutasít', () => {
    const most = Date.now();
    const url = alairtTartalomUtvonal(id, v, mid, most);
    const { exp, sig } = felbont(url);
    // 1 ms-mal a lejárat után
    expect(ervenyesAlairas(id, v, mid, exp, sig, exp + 1)).toBe(false);
    expect(ervenyesAlairas(id, v, mid, exp, sig, most)).toBe(true);
  });

  it('hiányzó exp/sig esetén false', () => {
    expect(ervenyesAlairas(id, v, mid, undefined, 'x')).toBe(false);
    expect(ervenyesAlairas(id, v, mid, Date.now() + 1000, undefined)).toBe(false);
  });
});
