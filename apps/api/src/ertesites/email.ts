import type { FastifyBaseLogger } from 'fastify';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface Level {
  cimzett: string;
  targy: string;
  szoveg: string;
  html: string;
}

/** Az e-mail csatorna varrata (a felületi értesítés ettől független). */
export interface EmailKuldo {
  kuld(level: Level): Promise<void>;
}

/** Alapértelmezés: nem küld, csak naplóz — éles bekapcsolásig biztonságos. */
export class NaploKuldo implements EmailKuldo {
  constructor(private readonly log: FastifyBaseLogger) {}
  async kuld(l: Level): Promise<void> {
    this.log.info({ ertesitesEmail: { cimzett: l.cimzett, targy: l.targy } }, 'E-mail (napló mód, nincs kiküldve)');
  }
}

export class NincsKuldo implements EmailKuldo {
  async kuld(): Promise<void> {}
}

export class SmtpKuldo implements EmailKuldo {
  private readonly transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.pass ?? '' } } : {}),
  });
  async kuld(l: Level): Promise<void> {
    await this.transport.sendMail({
      from: config.ertesitesFelado,
      to: l.cimzett,
      subject: l.targy,
      text: l.szoveg,
      html: l.html,
    });
  }
}

/** Tesztekhez: a „kiküldött" leveleket gyűjti. */
export class MemoriaKuldo implements EmailKuldo {
  readonly levelek: Level[] = [];
  async kuld(l: Level): Promise<void> {
    this.levelek.push(l);
  }
}

export function kuldoKonfigbol(log: FastifyBaseLogger): EmailKuldo {
  if (config.ertesitesEmail === 'smtp') return new SmtpKuldo();
  if (config.ertesitesEmail === 'ki') return new NincsKuldo();
  return new NaploKuldo(log);
}

/** Az engedélyezett-domain szelep: ha be van állítva, csak oda megy levél. */
export function emailEngedett(cim: string, domainek: string[] | undefined = config.ertesitesEmailDomainek): boolean {
  if (!domainek) return true;
  const domain = cim.split('@')[1]?.toLowerCase();
  return !!domain && domainek.includes(domain);
}
