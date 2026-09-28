import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { TIPUS_KODOK, RETEG_KODOK, uzletiTipus, type TipusKod } from '@kartotek/shared';
import { useAlkalmazasok, useElemLetrehozas } from '../api/hooks';
import { Modal, Hiba } from '../komponens/ui';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { uzenet } from '../allapot/uzenetek';
import { CIA_ALAP, dokumentumTipus, LEIRAS_SABLON, retegCimke, tipusCimke } from '../domain/szotar';

const Sema = z
  .object({
    alkalmazasKod: z.string().min(1, 'Válaszd ki az alkalmazást.'),
    tipusKod: z.enum(TIPUS_KODOK),
    retegKod: z.string().optional(),
    cim: z.string().trim().min(1, 'A cím kötelező.').max(200, 'A cím legfeljebb 200 karakter.'),
    rovid: z.string().max(300, 'A rövid leírás legfeljebb 300 karakter.').optional(),
    leirasMd: z.string().optional(),
    cimkek: z.string().optional(),
  })
  .refine((v) => uzletiTipus(v.tipusKod) || !!v.retegKod, {
    message: 'Technikai típushoz kötelező a réteg.',
    path: ['retegKod'],
  });

type Urlap = z.infer<typeof Sema>;

export function UjElemModal({
  alapAlkalmazas,
  onBezar,
}: {
  alapAlkalmazas: string;
  onBezar: () => void;
}) {
  const nav = useNavigate();
  const id = useId();
  const { data: alkalmazasok } = useAlkalmazasok();
  const letrehozas = useElemLetrehozas();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Urlap>({
    resolver: zodResolver(Sema),
    defaultValues: { alkalmazasKod: alapAlkalmazas, tipusKod: 'BUS' },
  });

  const tipus = watch('tipusKod') as TipusKod;
  const uzleti = uzletiTipus(tipus);
  const alk = watch('alkalmazasKod');
  const reteg = watch('retegKod');
  const kulcsMinta = `${alk || 'ALK'}-${!uzleti && reteg ? `${reteg}-` : ''}${tipus}-…`;

  /** Mező-akadálymentesség: címke-kapcsolat, hibaállapot és a hibaüzenet hozzárendelése. */
  const mezo = (nev: keyof Urlap) => ({
    id: `${id}-${nev}`,
    'aria-invalid': errors[nev] ? true : undefined,
    'aria-describedby': errors[nev] ? `${id}-${nev}-hiba` : undefined,
  });
  const hibaUzenet = (nev: keyof Urlap) =>
    errors[nev] ? (
      <p className="mezo-hiba" id={`${id}-${nev}-hiba`} role="alert">
        {errors[nev]!.message}
      </p>
    ) : null;

  const kuld = handleSubmit(async (v) => {
    const tipusMezok: Record<string, unknown> = {};
    if (v.rovid?.trim()) tipusMezok.rovid = v.rovid.trim();
    if (dokumentumTipus(v.tipusKod)) tipusMezok.cia = CIA_ALAP;
    const elem = await letrehozas
      .mutateAsync({
        alkalmazasKod: v.alkalmazasKod,
        tipusKod: v.tipusKod,
        retegKod: uzleti ? null : (v.retegKod ?? null),
        cim: v.cim.trim(),
        leirasMd: v.leirasMd ?? '',
        cimkek: v.cimkek ? v.cimkek.split(',').map((s) => s.trim()).filter(Boolean) : [],
        tipusMezok,
      })
      .catch(() => null); // a hiba a modálban látszik (letrehozas.error)
    if (!elem) return;
    onBezar();
    nav(`/elem/${elem.id}`);
    uzenet.siker(`Létrejött: ${elem.kulcs} v1 (Vázlat) — a szerkesztéssel folytathatod.`);
  });

  return (
    <Modal cim="Új elem létrehozása" onBezar={onBezar}>
      <form onSubmit={kuld} noValidate className="uj-elem-urlap">
        <label htmlFor={`${id}-alkalmazasKod`}>Alkalmazás</label>
        <select {...mezo('alkalmazasKod')} {...register('alkalmazasKod')}>
          <option value="">— válassz —</option>
          {alkalmazasok?.map((a) => (
            <option key={a.kod} value={a.kod}>
              {a.kod} — {a.nev}
            </option>
          ))}
        </select>
        {hibaUzenet('alkalmazasKod')}

        <div className="kapcs-mezo-sor">
          <div>
            <label htmlFor={`${id}-tipusKod`}>Típus</label>
            <select {...mezo('tipusKod')} {...register('tipusKod')}>
              {TIPUS_KODOK.map((t) => (
                <option key={t} value={t}>
                  {tipusCimke(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-retegKod`}>
              Réteg {uzleti && <span className="mezo-sugo-inline">(csak technikai típusnál)</span>}
            </label>
            <select disabled={uzleti} {...mezo('retegKod')} {...register('retegKod')}>
              <option value="">{uzleti ? '— üzleti elem: nincs —' : '— válassz —'}</option>
              {RETEG_KODOK.map((r) => (
                <option key={r} value={r}>
                  {retegCimke(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hibaUzenet('retegKod')}
        <p className="mezo-sugo">
          Az azonosító automatikusan készül: <code>{kulcsMinta}</code>
        </p>

        <label htmlFor={`${id}-cim`}>
          Cím <span aria-hidden="true">*</span>
        </label>
        <input type="text" required maxLength={200} {...mezo('cim')} {...register('cim')} />
        {hibaUzenet('cim')}

        <label htmlFor={`${id}-rovid`}>Rövid leírás</label>
        <input
          type="text"
          maxLength={300}
          placeholder="Egy mondatban: miről szól?"
          {...mezo('rovid')}
          {...register('rovid')}
        />
        {hibaUzenet('rovid')}

        <div className="uj-elem-leiras-fej">
          <label htmlFor={`${id}-leirasMd`}>Részletes leírás</label>
          <button
            type="button"
            className="kapcs-link"
            onClick={() => setValue('leirasMd', LEIRAS_SABLON[tipus], { shouldDirty: true })}
          >
            Sablon beszúrása ({tipus})
          </button>
        </div>
        <textarea placeholder={LEIRAS_SABLON[tipus]} {...mezo('leirasMd')} {...register('leirasMd')} />

        <label htmlFor={`${id}-cimkek`}>Címkék (vesszővel elválasztva)</label>
        <input type="text" placeholder="pl. regisztráció, e-mail" {...mezo('cimkek')} {...register('cimkek')} />

        {letrehozas.isError && <Hiba uzenet={hibaSzoveg(letrehozas.error)} />}

        <div className="modal-gombok">
          <button type="button" className="btn masodlagos" onClick={onBezar}>Mégse</button>
          <button type="submit" className="btn" disabled={letrehozas.isPending}>
            {letrehozas.isPending ? 'Létrehozás…' : 'Létrehozás'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
