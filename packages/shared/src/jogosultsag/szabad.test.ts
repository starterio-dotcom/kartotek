import { describe, it, expect } from 'vitest';
import { szabad, elerhetoVerzioMuveletek, type FelhasznaloCtx, type Muvelet } from './szabad';
import type { Szerepkor } from '../tipusok';

const ALK = '3R';

function felh(szerepkor: Szerepkor | null, opts: Partial<FelhasznaloCtx> = {}): FelhasznaloCtx {
  return {
    id: opts.id ?? 'u1',
    globalisAdmin: opts.globalisAdmin ?? false,
    tagsagok: szerepkor ? [{ alkalmazasKod: ALK, szerepkor }] : (opts.tagsagok ?? []),
  };
}

describe('jogosultság — alap-mátrix', () => {
  it('Olvasó csak olvashat', () => {
    const f = felh('Olvasó');
    expect(szabad('elem.olvasás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(true);
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(false);
    expect(szabad('kapcsolat.kezelés', { felhasznalo: f, alkalmazasKod: ALK })).toBe(false);
  });

  it('Szerző létrehoz, szerkeszt, kapcsolatot kezel, de nem hagy jóvá', () => {
    const f = felh('Szerző');
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(true);
    expect(szabad('kapcsolat.kezelés', { felhasznalo: f, alkalmazasKod: ALK })).toBe(true);
    expect(
      szabad('verzió.jóváhagyás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: ['masvalaki'] },
      }),
    ).toBe(false);
  });

  it('Jóváhagyó jóváhagy és visszadob, de nem hoz létre elemet', () => {
    const f = felh('Jóváhagyó');
    expect(
      szabad('verzió.jóváhagyás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: ['szerzo'] },
      }),
    ).toBe(true);
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(false);
  });

  it('Admin kivezet és archivál', () => {
    const f = felh('Admin');
    expect(
      szabad('verzió.kivezetés', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Hatályos', szerkesztoIds: [] },
      }),
    ).toBe(true);
    expect(
      szabad('verzió.archiválás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Elavult', szerkesztoIds: [] },
      }),
    ).toBe(true);
  });
});

describe('jogosultság — hatókör és rendszerszint', () => {
  it('tagság nélküli felhasználó semmihez', () => {
    const f = felh(null);
    const muveletek: Muvelet[] = ['elem.létrehozás', 'vázlat.szerkesztés', 'kapcsolat.kezelés'];
    for (const m of muveletek) {
      expect(szabad(m, { felhasznalo: f, alkalmazasKod: ALK })).toBe(false);
    }
  });

  it('más alkalmazás tagsága nem ad jogot ezen az alkalmazáson', () => {
    const f = felh(null, { tagsagok: [{ alkalmazasKod: 'Terminus', szerepkor: 'Szerző' }] });
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(false);
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: 'Terminus' })).toBe(true);
  });

  it('szolgáltatás.kezelés kizárólag globális Adminnak', () => {
    expect(szabad('szolgáltatás.kezelés', { felhasznalo: felh('Admin') })).toBe(false);
    expect(
      szabad('szolgáltatás.kezelés', { felhasznalo: felh(null, { globalisAdmin: true }) }),
    ).toBe(true);
  });

  it('globális Admin minden alkalmazáson átmegy', () => {
    const f = felh(null, { globalisAdmin: true });
    expect(szabad('elem.létrehozás', { felhasznalo: f, alkalmazasKod: ALK })).toBe(true);
    expect(szabad('verzió.archiválás', {
      felhasznalo: f,
      alkalmazasKod: ALK,
      verzio: { statusz: 'Elavult', szerkesztoIds: [] },
    })).toBe(true);
  });
});

describe('jogosultság — négy-szem-elv', () => {
  it('a szerző a saját verzióját nem hagyhatja jóvá', () => {
    const f = felh('Jóváhagyó', { id: 'szerzo' });
    expect(
      szabad('verzió.jóváhagyás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: ['szerzo'] },
      }),
    ).toBe(false);
  });

  it('a globális Admin sem hagyhatja jóvá a sajátját', () => {
    const f = felh(null, { id: 'szerzo', globalisAdmin: true });
    expect(
      szabad('verzió.jóváhagyás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: ['szerzo'] },
      }),
    ).toBe(false);
  });

  it('másvalaki jóváhagyhatja', () => {
    const f = felh('Jóváhagyó', { id: 'masvalaki' });
    expect(
      szabad('verzió.jóváhagyás', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: ['szerzo'] },
      }),
    ).toBe(true);
  });
});

describe('jogosultság — státusz-előfeltétel és új verzió', () => {
  it('beküldés csak Vázlatból', () => {
    const f = felh('Szerző');
    expect(
      szabad('verzió.beküldés', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Vázlat', szerkesztoIds: [] },
      }),
    ).toBe(true);
    expect(
      szabad('verzió.beküldés', {
        felhasznalo: f,
        alkalmazasKod: ALK,
        verzio: { statusz: 'Véleményezés', szerkesztoIds: [] },
      }),
    ).toBe(false);
  });

  it('új verzió csak ha nincs még újabb aktív verzió', () => {
    const f = felh('Szerző');
    const base = {
      felhasznalo: f,
      alkalmazasKod: ALK,
      verzio: { statusz: 'Hatályos' as const, szerkesztoIds: [] },
    };
    expect(szabad('verzió.újverzió', { ...base, vanUjabbAktivVerzio: false })).toBe(true);
    expect(szabad('verzió.újverzió', { ...base, vanUjabbAktivVerzio: true })).toBe(false);
  });

  it('elerhetoVerzioMuveletek a státusz + szerepkör szerint szűr', () => {
    const szerzo = felh('Szerző', { id: 'szerzo' });
    const muveletek = elerhetoVerzioMuveletek({
      felhasznalo: szerzo,
      alkalmazasKod: ALK,
      verzio: { statusz: 'Vázlat', szerkesztoIds: ['szerzo'] },
    });
    expect(muveletek).toContain('verzió.beküldés');
    expect(muveletek).toContain('verzió.elvetés');
    expect(muveletek).not.toContain('verzió.jóváhagyás');
  });
});
