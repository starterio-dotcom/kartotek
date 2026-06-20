import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { szabad } from '@kartotek/shared';
import {
  useHatas,
  useKiadasok,
  useVerzioKiadas,
  useTorolheto,
  useElemTorles,
} from '../api/hooks';
import { Modal, Hiba } from '../komponens/ui';
import type { Elem, Verzio, Felhasznalo, HatasElem } from '../api/tipusok';

/* ---------- Hatáselemzés ---------- */

function HatasLista({ cim, ures, elemek }: { cim: string; ures: string; elemek: HatasElem[] }) {
  return (
    <div className="hatas-csoport">
      <div className="hatas-fej">{cim}</div>
      {elemek.length === 0 ? (
        <span className="ures">{ures}</span>
      ) : (
        <ul className="riport-lista">
          {elemek.map((e) => (
            <li key={e.id} className="riport-sor">
              <span className="hatas-melyseg" title={`${e.melyseg} lépés távol`}>·{e.melyseg}</span>
              <Link className="kapcs-link" to={`/elem/${e.id}`}>
                <span className="riport-kulcs">{e.kulcs}</span> {e.cim}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HatasPanel({ elem }: { elem: Elem }) {
  const [nyitva, setNyitva] = useState(false);
  const { data, isLoading } = useHatas(nyitva ? elem.id : undefined);
  return (
    <div className="blokk">
      <div className="blokk-cim blokk-cim-sor">
        Hatáselemzés
        <button className="szerk-gomb" onClick={() => setNyitva((v) => !v)}>
          {nyitva ? 'Elrejt' : 'Megnéz'}
        </button>
      </div>
      {nyitva &&
        (isLoading || !data ? (
          <div className="torzs"><span className="ures">Betöltés…</span></div>
        ) : (
          <>
            <HatasLista
              cim="Felfelé — ezekre hat a változás"
              ures="Semmi nem függ ettől / nem bontja le."
              elemek={data.felfele}
            />
            <HatasLista
              cim="Lefelé — ezt bontja le / ettől függ"
              ures="Nincs lefelé mutató lebontja/függ tőle kapcsolat."
              elemek={data.lefele}
            />
          </>
        ))}
    </div>
  );
}

/* ---------- Kiadás-hozzárendelés ---------- */

export function KiadasPanel({
  elem,
  verzio,
  felhasznalo,
}: {
  elem: Elem;
  verzio: Verzio;
  felhasznalo: Felhasznalo;
}) {
  const { data: kiadasok } = useKiadasok();
  const beallit = useVerzioKiadas(elem.id);
  const kezelheto = szabad('kiadás.kezelés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });
  const aktivak = new Set(verzio.kiadasIds ?? []);
  const lista = kiadasok ?? [];

  return (
    <div className="blokk">
      <div className="blokk-cim">Kiadások</div>
      {lista.length === 0 ? (
        <div className="torzs"><span className="ures">Nincs kiadás. (Admin hozhat létre a Kiadások nézetben.)</span></div>
      ) : (
        <div className="kiadas-jelolok">
          {lista.map((k) => {
            const bent = aktivak.has(k.id);
            return (
              <label key={k.id} className={`kiadas-jelolo${bent ? ' aktiv' : ''}`}>
                <input
                  type="checkbox"
                  checked={bent}
                  disabled={!kezelheto || beallit.isPending}
                  onChange={(e) =>
                    beallit.mutate({ v: verzio.verzioSzam, kiadasId: k.id, hozzarendel: e.target.checked })
                  }
                />
                <span>{k.verzio}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Veszélyzóna: fizikai törlés ---------- */

export function VeszelyZona({ elem, felhasznalo }: { elem: Elem; felhasznalo: Felhasznalo }) {
  const nav = useNavigate();
  const torolhet = szabad('vázlat.törlés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });
  const { data } = useTorolheto(torolhet ? elem.id : undefined);
  const torles = useElemTorles();
  const [megerosit, setMegerosit] = useState(false);

  if (!torolhet || !data) return null;

  return (
    <div className="blokk veszely-blokk">
      <div className="blokk-cim">Veszélyzóna · törlés</div>
      {data.torolheto ? (
        <>
          <p className="torzs riport-osszegzo">
            Ez egy sosem hivatkozott Vázlat — fizikailag törölhető. A művelet nem visszavonható.
          </p>
          <button className="gomb veszelyes" onClick={() => setMegerosit(true)}>
            Elem törlése
          </button>
        </>
      ) : (
        <>
          <p className="torzs riport-osszegzo">Fizikailag nem törölhető:</p>
          <ul className="veszely-okok">
            {data.okok.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
          {data.ajanlott && (
            <p className="torzs">
              Javasolt művelet helyette: <b>{data.ajanlott}</b> (auditbiztos lezárás).
            </p>
          )}
        </>
      )}

      {megerosit && (
        <Modal cim="Elem végleges törlése" onBezar={() => setMegerosit(false)}>
          <p style={{ fontSize: 13 }}>
            A(z) <b>{elem.kulcs}</b> elem és kapcsolatai véglegesen törlődnek. Ez nem vonható vissza.
          </p>
          {torles.isError && <Hiba uzenet={(torles.error as Error).message} />}
          <div className="modal-gombok">
            <button className="btn masodlagos" onClick={() => setMegerosit(false)}>Mégse</button>
            <button
              className="btn"
              disabled={torles.isPending}
              onClick={() =>
                torles.mutate(elem.id, {
                  onSuccess: () => nav('/'),
                })
              }
            >
              Végleges törlés
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
