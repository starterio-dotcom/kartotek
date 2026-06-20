import { z } from 'zod';
import {
  STATUSZOK,
  SZEREPKOROK,
  TIPUS_KODOK,
  RETEG_KODOK,
  KAPCSOLAT_FAJTAK,
  MELLEKLET_TIPUSOK,
  MEGJEGYZES_ALLAPOTOK,
  DONTES_EREDMENYEK,
} from '../tipusok.js';

export const StatuszSchema = z.enum(STATUSZOK);
export const SzerepkorSchema = z.enum(SZEREPKOROK);
export const TipusKodSchema = z.enum(TIPUS_KODOK);
export const RetegKodSchema = z.enum(RETEG_KODOK);
export const KapcsolatFajtaSchema = z.enum(KAPCSOLAT_FAJTAK);
export const MellekletTipusSchema = z.enum(MELLEKLET_TIPUSOK);
export const MegjegyzesAllapotSchema = z.enum(MEGJEGYZES_ALLAPOTOK);
export const DontesEredmenySchema = z.enum(DONTES_EREDMENYEK);
