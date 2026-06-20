import { diffLines, type Change } from 'diff';
import type { Verzio } from '../api/tipusok';

/** Sima szöveg kinyerése TipTap-JSON-ból (a diffhez; a markdown önmagában is szöveg). */
function tiptapSzoveg(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const o = n as { text?: string; type?: string; content?: unknown[] };
    if (typeof o.text === 'string') out.push(o.text);
    if (Array.isArray(o.content)) {
      o.content.forEach(walk);
      if (o.type && ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(o.type))
        out.push('\n');
    }
  };
  walk(doc);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

function mezok(v: Verzio): Record<string, string> {
  const tm = (v.tipusMezok ?? {}) as {
    rovid?: string;
    elofeltetelek?: string;
    kriteriumok?: string;
  };
  return {
    Cím: v.cim ?? '',
    'Rövid leírás': tm.rovid ?? '',
    'Részletes leírás': v.leiras ? tiptapSzoveg(v.leiras) : (v.leirasMd ?? ''),
    Előfeltételek: tm.elofeltetelek ?? '',
    Kritériumok: tm.kriteriumok ?? '',
  };
}

function DiffMezo({ cim, a, b }: { cim: string; a: string; b: string }) {
  const reszek = diffLines(a || '', b || '');
  return (
    <div className="diff-mezo">
      <div className="diff-cim">{cim}</div>
      <pre className="diff-blokk" aria-label={`${cim} eltérései`}>
        {reszek.flatMap((p: Change, i) =>
          p.value
            .replace(/\n$/, '')
            .split('\n')
            .map((sor, j) => (
              <div
                key={`${i}-${j}`}
                className={p.added ? 'diff-add' : p.removed ? 'diff-del' : 'diff-eq'}
              >
                <span className="diff-jel" aria-hidden="true">
                  {p.added ? '+' : p.removed ? '−' : ' '}
                </span>
                {sor || ' '}
              </div>
            )),
        )}
      </pre>
    </div>
  );
}

/** Két verzió tartalmának mezőnkénti diffje (csak a változott mezők). */
export function VerzioDiff({ regi, uj }: { regi: Verzio; uj: Verzio }) {
  const a = mezok(regi);
  const b = mezok(uj);
  const valtozott = Object.keys(a).filter((k) => a[k] !== b[k]);
  return (
    <div className="blokk">
      <div className="blokk-cim">
        Összehasonlítás · v{regi.verzioSzam} ({regi.statusz}) → v{uj.verzioSzam} ({uj.statusz})
      </div>
      <p className="torzs riport-osszegzo">
        <span className="diff-add-jel">+ zöld</span> = a v{uj.verzioSzam}-ben hozzáadott,{' '}
        <span className="diff-del-jel">− piros</span> = a v{regi.verzioSzam}-ből eltávolított.
      </p>
      {valtozott.length === 0 ? (
        <div className="torzs">
          <span className="ures">A két verzió szöveges tartalma azonos.</span>
        </div>
      ) : (
        valtozott.map((k) => <DiffMezo key={k} cim={k} a={a[k]!} b={b[k]!} />)
      )}
    </div>
  );
}
