import { Types } from 'mongoose';
import { AuditBejegyzes, Elem, ElemSirko } from '../db/modellek.js';
import type { AuditEsemeny } from './plugin.js';

export interface AuditSzuro {
  /** E-mail (pontos), felhasználó-ID vagy névrészlet. */
  felhasznalo?: string;
  elemId?: string;
  esemeny?: AuditEsemeny;
  metodus?: string;
  statusz?: number;
  tol?: Date;
  ig?: Date;
  limit: number;
  offset: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Audit-bejegyzések szűrve, legújabb elöl, lapozva (+ az érintett elemek kulcsa). */
export async function auditLista(sz: AuditSzuro) {
  const q: Record<string, unknown> = {};
  if (sz.felhasznalo) {
    const f = sz.felhasznalo.trim();
    if (f.includes('@')) q.email = f.toLowerCase();
    else if (Types.ObjectId.isValid(f)) q.felhasznaloId = new Types.ObjectId(f);
    else q.nev = new RegExp(escape(f), 'i');
  }
  if (sz.elemId) q.elemId = sz.elemId;
  if (sz.esemeny) q.esemeny = sz.esemeny;
  if (sz.metodus) q.metodus = sz.metodus.toUpperCase();
  if (sz.statusz) q.statusz = sz.statusz;
  if (sz.tol || sz.ig) {
    q.idopont = { ...(sz.tol ? { $gte: sz.tol } : {}), ...(sz.ig ? { $lte: sz.ig } : {}) };
  }

  const [docs, osszes] = await Promise.all([
    AuditBejegyzes.find(q).sort({ idopont: -1, _id: -1 }).skip(sz.offset).limit(sz.limit).lean(),
    AuditBejegyzes.countDocuments(q),
  ]);

  // Az érintett elemek beszédes kulcsa a megjelenítéshez (egy lekérdezésben).
  const elemIdk = [...new Set(docs.map((d) => d.elemId).filter((x): x is string => !!x))].filter(
    (x) => Types.ObjectId.isValid(x),
  );
  const kulcsok = new Map<string, string>();
  const torolt = new Set<string>();
  if (elemIdk.length) {
    const elemek = await Elem.find({ _id: { $in: elemIdk } }).select('kulcs').lean();
    for (const e of elemek) kulcsok.set(String(e._id), e.kulcs);
    // A fizikailag törölt elemek kulcsa a sírkőből (így az auditban is beszédes marad).
    const hianyzo = elemIdk.filter((x) => !kulcsok.has(x));
    if (hianyzo.length) {
      const sirkovek = await ElemSirko.find({ elemId: { $in: hianyzo } }).select('elemId kulcs').lean();
      for (const s of sirkovek) {
        kulcsok.set(String(s.elemId), s.kulcs);
        torolt.add(String(s.elemId));
      }
    }
  }

  return {
    bejegyzesek: docs.map(({ _id, felhasznaloId, ...r }) => ({
      id: String(_id),
      ...r,
      felhasznaloId: felhasznaloId ? String(felhasznaloId) : null,
      elemKulcs: r.elemId ? (kulcsok.get(r.elemId) ?? null) : null,
      elemTorolve: r.elemId ? torolt.has(r.elemId) : false,
    })),
    osszes,
    limit: sz.limit,
    offset: sz.offset,
  };
}
