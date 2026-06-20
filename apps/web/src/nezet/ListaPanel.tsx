import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { TIPUS_KODOK, type Statusz } from '@kartotek/shared';
import { useElemek, useAlkalmazasok } from '../api/hooks';
import { api } from '../api/kliens';
import { Betolto, Hiba } from '../komponens/ui';
import type { Elem, Verzio } from '../api/tipusok';

/* ---------- Mentett szűrők (localStorage) ---------- */
const SZURO_KULCS = 'kartotek.mentett-szurok';
interface MentettSzuro {
  nev: string;
  q: string;
}
function szurokOlvas(): MentettSzuro[] {
  try {
    const x = JSON.parse(localStorage.getItem(SZURO_KULCS) ?? '[]');
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}
function szurokIr(lista: MentettSzuro[]): void {
  localStorage.setItem(SZURO_KULCS, JSON.stringify(lista));
}

const TABOK: { kulcs: string; nev: string; statuszok: Statusz[] | null }[] = [
  { kulcs: '', nev: 'Mind', statuszok: null },
  { kulcs: 'hatalyos', nev: 'Hatályos', statuszok: ['Hatályos'] },
  { kulcs: 'folyamatban', nev: 'Folyamatban', statuszok: ['Vázlat', 'Véleményezés', 'Jóváhagyott'] },
  { kulcs: 'lezart', nev: 'Lezárt', statuszok: ['Elavult', 'Archivált', 'Elvetve'] },
];

/** A listában kiemelt verzió: a legfrissebb nem-végállapotú, vagy a legmagasabb. */
function elsodlegesVerzio(e: Elem): Verzio {
  const aktiv = e.verziok.filter((v) => !['Elvetve', 'Archivált'].includes(v.statusz));
  const halmaz = aktiv.length ? aktiv : e.verziok;
  return halmaz.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), halmaz[0]!);
}

export function ListaPanel() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { id: aktivId } = useParams();

  const alk = params.get('alk') ?? '';
  const q = (params.get('q') ?? '').toLowerCase();
  const tab = params.get('tab') ?? '';
  const tipusHalmaz = new Set((params.get('tipus') ?? '').split(',').filter(Boolean));

  const { data, isLoading, isError, error } = useElemek(alk ? { alkalmazasKod: alk } : {});

  const valt = (kulcs: string, ertek: string) => {
    const uj = new URLSearchParams(params);
    if (ertek) uj.set(kulcs, ertek);
    else uj.delete(kulcs);
    setParams(uj);
  };
  const tipusValt = (t: string) => {
    if (tipusHalmaz.has(t)) tipusHalmaz.delete(t);
    else tipusHalmaz.add(t);
    valt('tipus', [...tipusHalmaz].join(','));
  };

  const qc = useQueryClient();
  const [szurok, setSzurok] = useState<MentettSzuro[]>(() => szurokOlvas());
  const aktualisMentett = szurok.find((s) => s.q === params.toString());

  // Tömeges műveletek: kijelölési mód + címkézés (elemenként a meglévő végpontra).
  const [valasztMod, setValasztMod] = useState(false);
  const [kijelolt, setKijelolt] = useState<Set<string>>(new Set());
  const valaszt = (eid: string) =>
    setKijelolt((h) => {
      const uj = new Set(h);
      if (uj.has(eid)) uj.delete(eid);
      else uj.add(eid);
      return uj;
    });
  const valasztModVege = () => {
    setValasztMod(false);
    setKijelolt(new Set());
  };
  const tomegesCimke = async () => {
    const cimke = window.prompt('Az összes kijelölt elemhez hozzáadandó címke:')?.trim();
    if (!cimke) return;
    for (const eid of kijelolt) {
      const e = (data ?? []).find((x) => x.id === eid);
      if (!e) continue;
      const ujCimkek = [...new Set([...(e.cimkek ?? []), cimke])];
      try {
        await api.patch(`/api/elemek/${eid}/cimkek`, { cimkek: ujCimkek });
      } catch {
        /* jogosultság hiánya / hiba → az adott elem kimarad */
      }
    }
    await qc.invalidateQueries({ queryKey: ['elemek'] });
    valasztModVege();
  };
  const szuroMent = () => {
    const q = params.toString();
    if (!q) return;
    const nev = window.prompt('Add meg a szűrő nevét:')?.trim();
    if (!nev) return;
    const uj = [...szurok.filter((s) => s.nev !== nev), { nev, q }];
    setSzurok(uj);
    szurokIr(uj);
  };
  const szuroTorol = (nev: string) => {
    const uj = szurok.filter((s) => s.nev !== nev);
    setSzurok(uj);
    szurokIr(uj);
  };

  const aktivTab = TABOK.find((t) => t.kulcs === tab) ?? TABOK[0]!;
  const talalatok = (data ?? []).filter((e) => {
    if (tipusHalmaz.size && !tipusHalmaz.has(e.tipusKod)) return false;
    if (aktivTab.statuszok && !e.verziok.some((v) => aktivTab.statuszok!.includes(v.statusz)))
      return false;
    if (
      q &&
      !(
        e.kulcs.toLowerCase().includes(q) ||
        e.verziok.some((v) => v.cim.toLowerCase().includes(q)) ||
        e.cimkek.join(' ').toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  return (
    <>
      <div className="panel-fej">
        <div className="mentett-szurok-sor">
          <select
            aria-label="Mentett szűrő betöltése"
            value=""
            onChange={(e) => e.target.value && setParams(new URLSearchParams(e.target.value))}
          >
            <option value="">Mentett szűrő…</option>
            {szurok.map((s) => (
              <option key={s.nev} value={s.q}>
                {s.nev}
              </option>
            ))}
          </select>
          <button className="chip" onClick={szuroMent} title="Aktuális szűrő mentése">
            ＋ Mentés
          </button>
          {aktualisMentett && (
            <button
              className="chip"
              onClick={() => szuroTorol(aktualisMentett.nev)}
              title={`„${aktualisMentett.nev}" törlése`}
            >
              🗑
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            className={`chip${valasztMod ? ' aktiv' : ''}`}
            aria-pressed={valasztMod}
            onClick={() => (valasztMod ? valasztModVege() : setValasztMod(true))}
            title="Tömeges kijelölés"
          >
            ☑ Kijelölés
          </button>
        </div>
        <div className="szuro-sor" role="group" aria-label="Alkalmazás szűrő">
          <button className={`chip${!alk ? ' aktiv' : ''}`} onClick={() => valt('alk', '')}>
            Összes
          </button>
          <AlkChipek alk={alk} onValt={(k) => valt('alk', k)} />
        </div>

        <div className="szegmens">
          {TABOK.map((t) => {
            const db = (data ?? []).filter(
              (e) => !t.statuszok || e.verziok.some((v) => t.statuszok!.includes(v.statusz)),
            ).length;
            return (
              <button
                key={t.kulcs}
                className={aktivTab.kulcs === t.kulcs ? 'aktiv' : ''}
                onClick={() => valt('tab', t.kulcs)}
              >
                {t.nev}
                <span className="db">{db}</span>
              </button>
            );
          })}
        </div>

        <div className="szuro-sor" role="group" aria-label="Típus szűrő">
          {TIPUS_KODOK.map((t) => (
            <button
              key={t}
              className={`chip${tipusHalmaz.has(t) ? ' aktiv' : ''}`}
              onClick={() => tipusValt(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="lista">
        {isLoading && <Betolto />}
        {isError && <Hiba uzenet={(error as Error).message} />}
        {data && talalatok.length === 0 && (
          <div className="lista-ures">
            Nincs a szűrésnek megfelelő elem.
            <br />
            Módosítsd a keresést vagy a szűrőket.
          </div>
        )}
        {talalatok.map((e) => {
          const ver = elsodlegesVerzio(e);
          const masodlagos = e.verziok.filter(
            (v) => v.verzioSzam !== ver.verzioSzam && !['Elvetve', 'Archivált'].includes(v.statusz),
          );
          return (
            <button
              key={e.id}
              className={`lista-elem${aktivId === e.id ? ' kivalasztott' : ''}${
                valasztMod && kijelolt.has(e.id) ? ' bejelolt' : ''
              }`}
              onClick={() =>
                valasztMod ? valaszt(e.id) : nav(`/elem/${e.id}?${params.toString()}`)
              }
            >
              <div className="le-sor1">
                {valasztMod && (
                  <input
                    type="checkbox"
                    readOnly
                    checked={kijelolt.has(e.id)}
                    className="le-pipa"
                    aria-label={`${e.kulcs} kijelölése`}
                  />
                )}
                <span className="lista-kulcs">{e.kulcs}</span>
                <span className="tolto" />
                <span className={`badge mini b-${ver.statusz}`}>{ver.statusz}</span>
              </div>
              <div className="lista-cim">{ver.cim}</div>
              <div className="lista-meta">
                <span>
                  {e.tipusKod}
                  {e.retegKod ? ` · ${e.retegKod}` : ''}
                </span>
                {masodlagos.map((v) => (
                  <span key={v.verzioSzam} className={`badge mini b-${v.statusz}`}>
                    v{v.verzioSzam} {v.statusz}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {valasztMod && (
        <div className="tomeges-sav">
          <span className="tomeges-db">{kijelolt.size} kijelölve</span>
          <button
            className="gomb elsodleges kicsi"
            disabled={kijelolt.size === 0}
            onClick={tomegesCimke}
          >
            ＋ Címke
          </button>
          <button className="gomb masodlagos kicsi" onClick={valasztModVege}>
            Mégse
          </button>
        </div>
      )}
    </>
  );
}

function AlkChipek({ alk, onValt }: { alk: string; onValt: (kod: string) => void }) {
  const { data } = useAlkalmazasok();
  return (
    <>
      {(data ?? []).map((a) => (
        <button key={a.kod} className={`chip${alk === a.kod ? ' aktiv' : ''}`} onClick={() => onValt(a.kod)}>
          {a.kod}
        </button>
      ))}
    </>
  );
}
