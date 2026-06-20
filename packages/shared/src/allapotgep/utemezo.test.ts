import { describe, it, expect } from 'vitest';
import { esedekesAutoAtmenet } from './utemezo';

const nap = (s: string) => new Date(s + 'T00:00:00Z');
const MA = nap('2026-06-17');

describe('ütemező — esedékes automata átmenet', () => {
  it('Jóváhagyott → Hatályos, ha a kezdődátum elérve (= ma)', () => {
    expect(
      esedekesAutoAtmenet({ statusz: 'Jóváhagyott', hatalyKezdet: MA, hatalyVeg: null }, MA),
    ).toEqual({ muvelet: 'hatálybalépés', ujStatusz: 'Hatályos' });
  });

  it('Jóváhagyott marad, ha a kezdődátum a jövőben van', () => {
    expect(
      esedekesAutoAtmenet(
        { statusz: 'Jóváhagyott', hatalyKezdet: nap('2026-06-18'), hatalyVeg: null },
        MA,
      ),
    ).toBeNull();
  });

  it('Hatályos → Elavult, ha a végdátum már elmúlt (vég < ma)', () => {
    expect(
      esedekesAutoAtmenet(
        { statusz: 'Hatályos', hatalyKezdet: nap('2026-01-01'), hatalyVeg: nap('2026-06-16') },
        MA,
      ),
    ).toEqual({ muvelet: 'elavulás', ujStatusz: 'Elavult' });
  });

  it('Hatályos marad, ha a végdátum ma van (vég = ma még nem múlt el)', () => {
    expect(
      esedekesAutoAtmenet({ statusz: 'Hatályos', hatalyKezdet: nap('2026-01-01'), hatalyVeg: MA }, MA),
    ).toBeNull();
  });

  it('üres dátumoknál nincs automata átmenet', () => {
    expect(
      esedekesAutoAtmenet({ statusz: 'Jóváhagyott', hatalyKezdet: null, hatalyVeg: null }, MA),
    ).toBeNull();
    expect(
      esedekesAutoAtmenet({ statusz: 'Hatályos', hatalyKezdet: null, hatalyVeg: null }, MA),
    ).toBeNull();
  });

  it('más státuszokra nincs automata átmenet', () => {
    expect(
      esedekesAutoAtmenet({ statusz: 'Vázlat', hatalyKezdet: MA, hatalyVeg: MA }, MA),
    ).toBeNull();
  });
});
