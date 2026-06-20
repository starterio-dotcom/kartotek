import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { csvParse } from './MellekletNezo';
import { Markdown } from './Markdown';
import type { Melleklet } from '../api/tipusok';

describe('csvParse', () => {
  it('fejlécre és sorokra bontja a CSV-t', () => {
    expect(csvParse('a,b\n1,2\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

const kepMelleklet: Melleklet = {
  mid: 'M2',
  tipus: 'kep',
  alt: 'Űrlap vázlat',
  tartalomHiv: 'lemez:abc',
  mime: 'image/png',
};

describe('Markdown melleklet:ID beágyazás', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('kép mellékletet beágyaz (a tartalmat lekéri)', () => {
    vi.stubGlobal('fetch', () => new Promise(() => {})); // függőben tartjuk
    render(
      <Markdown
        szoveg={'![Vázlat](melleklet:M2)'}
        melleklet={{ elemId: 'e1', verzioSzam: 1, mellekletek: [kepMelleklet] }}
      />,
    );
    expect(screen.getByText(/kép betöltése/)).toBeInTheDocument();
  });

  it('ismeretlen mid esetén jelölést mutat', () => {
    render(
      <Markdown
        szoveg={'![x](melleklet:NINCS)'}
        melleklet={{ elemId: 'e1', verzioSzam: 1, mellekletek: [kepMelleklet] }}
      />,
    );
    expect(screen.getByText(/melléklet:/)).toBeInTheDocument();
  });
});
