import { describe, it, expect } from 'vitest';
import { jogiZarolasTiltja } from './jogiZarolas.js';

const zarolva = { aktiv: true, ok: 'Hatósági megkeresés' };

describe('jogi zárolás', () => {
  it('aktív zárolás a lezáró/eltávolító műveleteket tiltja', () => {
    for (const m of ['vázlat.törlés', 'verzió.elvetés', 'verzió.archiválás', 'melléklet.törlés', 'kapcsolat.törlés'])
      expect(jogiZarolasTiltja(m, zarolva)).toBe(true);
  });

  it('a tartalmi munkát és a jóváhagyási folyamatot nem tiltja', () => {
    for (const m of ['vázlat.szerkesztés', 'verzió.beküldés', 'verzió.jóváhagyás', 'verzió.újverzió', 'kapcsolat.kezelés'])
      expect(jogiZarolasTiltja(m, zarolva)).toBe(false);
  });

  it('feloldott vagy hiányzó zárolás semmit sem tilt', () => {
    expect(jogiZarolasTiltja('vázlat.törlés', { aktiv: false, ok: 'x' })).toBe(false);
    expect(jogiZarolasTiltja('vázlat.törlés', null)).toBe(false);
  });
});
