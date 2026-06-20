import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { TIPUS_KODOK, RETEG_KODOK, uzletiTipus, type TipusKod } from '@kartotek/shared';
import { useAlkalmazasok, useElemLetrehozas } from '../api/hooks';
import { Modal, Hiba } from '../komponens/ui';
import { ApiHiba } from '../api/kliens';

const Sema = z
  .object({
    alkalmazasKod: z.string().min(1, 'Kötelező'),
    tipusKod: z.enum(TIPUS_KODOK),
    retegKod: z.string().optional(),
    cim: z.string().min(1, 'A cím kötelező'),
    leirasMd: z.string().optional(),
    cimkek: z.string().optional(),
  })
  .refine((v) => uzletiTipus(v.tipusKod) || !!v.retegKod, {
    message: 'Technikai típushoz kötelező a réteg',
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
  const { data: alkalmazasok } = useAlkalmazasok();
  const letrehozas = useElemLetrehozas();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Urlap>({
    resolver: zodResolver(Sema),
    defaultValues: { alkalmazasKod: alapAlkalmazas, tipusKod: 'BUS' },
  });

  const uzleti = uzletiTipus(watch('tipusKod') as TipusKod);

  const kuld = handleSubmit(async (v) => {
    const elem = await letrehozas.mutateAsync({
      alkalmazasKod: v.alkalmazasKod,
      tipusKod: v.tipusKod,
      retegKod: uzleti ? null : (v.retegKod ?? null),
      cim: v.cim,
      leirasMd: v.leirasMd ?? '',
      cimkek: v.cimkek ? v.cimkek.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
    onBezar();
    nav(`/elem/${elem.id}`);
  });

  return (
    <Modal cim="Új elem létrehozása" onBezar={onBezar}>
      <form onSubmit={kuld}>
        <label>Alkalmazás</label>
        <select {...register('alkalmazasKod')}>
          <option value="">— válassz —</option>
          {alkalmazasok?.map((a) => (
            <option key={a.kod} value={a.kod}>
              {a.kod} — {a.nev}
            </option>
          ))}
        </select>
        {errors.alkalmazasKod && <Hiba uzenet={errors.alkalmazasKod.message!} />}

        <div className="kapcs-mezo-sor">
          <div>
            <label>Típus</label>
            <select {...register('tipusKod')}>
              {TIPUS_KODOK.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Réteg</label>
            <select disabled={uzleti} {...register('retegKod')}>
              <option value="">{uzleti ? '— üzleti: nincs —' : '— válassz —'}</option>
              {RETEG_KODOK.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        {errors.retegKod && <Hiba uzenet={errors.retegKod.message!} />}

        <label>Cím</label>
        <input type="text" {...register('cim')} />
        {errors.cim && <Hiba uzenet={errors.cim.message!} />}

        <label>Leírás (markdown)</label>
        <textarea {...register('leirasMd')} />

        <label>Címkék (vesszővel)</label>
        <input type="text" {...register('cimkek')} />

        {letrehozas.isError && <Hiba uzenet={(letrehozas.error as ApiHiba).message} />}

        <div className="modal-gombok">
          <button type="button" className="btn masodlagos" onClick={onBezar}>Mégse</button>
          <button type="submit" className="btn" disabled={letrehozas.isPending}>Létrehozás</button>
        </div>
      </form>
    </Modal>
  );
}
