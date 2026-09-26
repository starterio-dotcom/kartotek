import { describe, it, expect } from 'vitest';
import { muveletCimke, eredmenyCimke, ESEMENY_FELIRAT } from './audit';

describe('audit megjelenítés', () => {
  it('az ismert útvonal-mintát emberi műveletnévre fordítja', () => {
    expect(muveletCimke('POST', '/api/elemek/:id/verziok/:v/jovahagyas')).toBe('Jóváhagyás');
    expect(muveletCimke('PATCH', '/api/felhasznalok/:id')).toBe('Szerepkör-módosítás');
    expect(muveletCimke('GET', '/api/elemek/:id/verziok/:v/mellekletek/:mid/tartalom')).toBe(
      'Melléklet megnyitása',
    );
  });

  it('ismeretlen útvonalnál a nyers metódus+minta a felirat', () => {
    expect(muveletCimke('PUT', '/api/valami/:x')).toBe('PUT /api/valami/:x');
  });

  it('az eredményt és az eseményt szöveggel is kiírja', () => {
    expect(eredmenyCimke(201)).toBe('Sikeres');
    expect(eredmenyCimke(403)).toBe('Nincs jogosultság');
    expect(eredmenyCimke(409)).toBe('Ütközés');
    expect(eredmenyCimke(500)).toBe('Szerverhiba');
    expect(ESEMENY_FELIRAT['hozzaferes-megtagadva']).toBe('Elutasított hozzáférés');
  });
});
