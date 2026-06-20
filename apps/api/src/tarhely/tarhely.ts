import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Fájltároló absztrakció. Most lemez-implementáció; később S3-kompatibilis
 * object storage cserélhető be ugyanezzel az interfésszel (Fázis 7).
 * A `ref` egy átlátszatlan hivatkozás, ami a melléklet `tartalomHiv` mezőjébe kerül.
 */
export interface Tarhely {
  ment(buffer: Buffer): Promise<string>;
  olvas(ref: string): Promise<Buffer | null>;
  torol(ref: string): Promise<void>;
}

const ELOTAG = 'lemez:';

export class LemezTarhely implements Tarhely {
  constructor(private readonly dir: string) {}

  async ment(buffer: Buffer): Promise<string> {
    const id = randomUUID();
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, id), buffer);
    return `${ELOTAG}${id}`;
  }

  async olvas(ref: string): Promise<Buffer | null> {
    if (!ref.startsWith(ELOTAG)) return null;
    try {
      return await readFile(join(this.dir, ref.slice(ELOTAG.length)));
    } catch {
      return null;
    }
  }

  async torol(ref: string): Promise<void> {
    if (!ref.startsWith(ELOTAG)) return;
    await rm(join(this.dir, ref.slice(ELOTAG.length)), { force: true });
  }
}

/** Igaz, ha a ref ténylegesen tárolt (kiszolgálható) fájlra mutat. */
export function tarolt(ref: string | undefined | null): boolean {
  return !!ref && ref.startsWith(ELOTAG);
}
