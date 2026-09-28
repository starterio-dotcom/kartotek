import { Link } from 'react-router-dom';
import { useMunkam } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto, Hiba, StatuszJelveny } from '../komponens/ui';
import type { MunkamTetel } from '../api/tipusok';

const datumHu = (d: string | null) => (d ? new Date(d).toLocaleDateString('hu-HU') : '—');

/** „3 napja", „ma", „holnap", „12 nap múlva" — a relatív idő gyorsabban olvasható. */
function relativ(d: string | null): string {
  if (!d) return '';
  const nap = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (nap === 0) return 'ma';
  if (nap === -1) return 'tegnap';
  if (nap === 1) return 'holnap';
  return nap < 0 ? `${-nap} napja` : `${nap} nap múlva`;
}

/** Hatálydátum a „Munkám"-ban: a már elmúlt dátum esedékes (az ütemező a következő futáskor lépteti). */
function hatalyMeta(ige: string, d: string | null): string {
  const mult = !!d && new Date(d).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  return mult
    ? `${ige} esedékes volt: ${datumHu(d)} — az ütemező a következő futáskor lépteti`
    : `${ige}: ${datumHu(d)} (${relativ(d)})`;
}

function Sor({ t, meta }: { t: MunkamTetel; meta: string }) {
  return (
    <li className="munkam-sor">
      <Link className="munkam-link" to={`/elem/${t.elemId}?v=${t.verzioSzam}`}>
        <span className="riport-kulcs">
          {t.kulcs} v{t.verzioSzam}
        </span>{' '}
        <span className="munkam-cim">{t.cim}</span>
      </Link>
      <div className="munkam-meta">
        <StatuszJelveny statusz={t.statusz} meret="mini" /> {meta}
        {t.nyitottMegjegyzes ? ` · ${t.nyitottMegjegyzes} nyitott megjegyzés` : ''}
      </div>
      {t.indoklas && <div className="munkam-indoklas">„{t.indoklas}”</div>}
    </li>
  );
}

function Szakasz({
  cim,
  leiras,
  ures,
  tetelek,
  meta,
  kiemelt = false,
}: {
  cim: string;
  leiras: string;
  ures: string;
  tetelek: MunkamTetel[];
  meta: (t: MunkamTetel) => string;
  kiemelt?: boolean;
}) {
  return (
    <section className={`blokk munkam-szakasz${kiemelt && tetelek.length ? ' kiemelt' : ''}`} aria-label={cim}>
      <h3 className="blokk-cim">
        {cim} · {tetelek.length}
      </h3>
      <p className="munkam-leiras">{leiras}</p>
      {tetelek.length === 0 ? (
        <div className="torzs">
          <span className="ures">{ures}</span>
        </div>
      ) : (
        <ul className="munkam-lista">
          {tetelek.map((t) => (
            <Sor key={`${t.elemId}-${t.verzioSzam}`} t={t} meta={meta(t)} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * „Munkám": a bejelentkezett felhasználó teendői egy helyen — mi vár rám döntésre, mit
 * dobtak vissza, min dolgozom, és mi lép hatályba / veszti hatályát hamarosan.
 */
export function Munkam() {
  const { felhasznalo } = useAuth();
  const { data, isLoading, isError, error } = useMunkam(!!felhasznalo);
  if (isLoading || !felhasznalo) return <Betolto />;
  if (isError || !data) return <Hiba uzenet={(error as Error)?.message ?? 'A teendők nem tölthetők be.'} />;

  const szerepek = new Set(felhasznalo.tagsagok.map((t) => t.szerepkor));
  const dontesHozo = felhasznalo.globalisAdmin || szerepek.has('Jóváhagyó') || szerepek.has('Admin');
  const szerzo = felhasznalo.globalisAdmin || szerepek.has('Szerző') || szerepek.has('Admin');
  const osszes = Object.values(data).reduce((n, l) => n + l.length, 0);

  return (
    <div className="munkam">
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Munkám</h2>
        <div className="reszlet-altipus">
          {osszes === 0
            ? 'Nincs teendőd — minden rendben.'
            : `A teendőid a látható alkalmazásokban, sürgősség szerint. (${felhasznalo.nev})`}
        </div>
      </div>
      <div className="munkam-racs">
        {dontesHozo && (
          <Szakasz
            kiemelt
            cim="Rám vár — döntés"
            leiras="Véleményezésre beküldött verziók, amelyeket te hagyhatsz jóvá vagy dobhatsz vissza (a saját verziód nincs itt — négy-szem-elv)."
            ures="Nincs döntésre váró verzió."
            tetelek={data.ramVar}
            meta={(t) => `beküldte ${t.kiNev ?? 'ismeretlen'}, ${relativ(t.mikor)}`}
          />
        )}
        {szerzo && (
          <Szakasz
            kiemelt
            cim="Visszadobva — javítanod kell"
            leiras="A saját verzióid, amelyeket a jóváhagyó visszaküldött. Javítás után küldd be újra."
            ures="Nincs visszadobott verziód."
            tetelek={data.visszadobva}
            meta={(t) => `visszadobta ${t.kiNev ?? 'ismeretlen'}, ${relativ(t.mikor)}`}
          />
        )}
        {szerzo && (
          <Szakasz
            cim="Vázlataim"
            leiras="Még be nem küldött verziók, amelyeken dolgozol."
            ures="Nincs nyitott vázlatod."
            tetelek={data.vazlataim}
            meta={(t) => `létrehozva ${datumHu(t.mikor)}`}
          />
        )}
        {szerzo && (
          <Szakasz
            cim="Beküldve — döntésre vár"
            leiras="A saját verzióid a jóváhagyónál."
            ures="Nincs beküldött, függő verziód."
            tetelek={data.bekuldve}
            meta={(t) => `beküldve ${relativ(t.mikor)}`}
          />
        )}
        <Szakasz
          cim="Hamarosan hatályba lép"
          leiras="Jóváhagyott verziók, amelyeket 30 napon belül az ütemező Hatályossá léptet."
          ures="30 napon belül nem lép hatályba semmi."
          tetelek={data.hamarosanHatalyos}
          meta={(t) => hatalyMeta('hatálybalépés', t.mikor)}
        />
        <Szakasz
          cim="Hamarosan lejár"
          leiras="Hatályos verziók, amelyek 30 napon belül elavulnak — ha kell, nyiss új verziót időben."
          ures="30 napon belül nem jár le semmi."
          tetelek={data.hamarosanLejar}
          meta={(t) => hatalyMeta('hatályvesztés', t.mikor)}
        />
      </div>
      {!dontesHozo && !szerzo && (
        <p className="munkam-leiras" style={{ padding: '0 28px' }}>
          Olvasó szerepkörrel nincs jóváhagyási vagy szerkesztési teendőd; a lejáró és hatályba lépő verziók az
          érintett alkalmazások szerkesztőinek jelennek meg.
        </p>
      )}
    </div>
  );
}
