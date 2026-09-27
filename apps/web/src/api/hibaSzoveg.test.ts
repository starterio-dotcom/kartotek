import { describe, it, expect } from 'vitest';
import { ApiHiba } from './kliens';
import { hibaSzoveg, reszletekSzoveg, statuszSzoveg } from './hibaSzoveg';

describe('hibaSzoveg — olvasható, magyar hibaüzenetek', () => {
  it('Zod-issue-kból mezőnév + magyar üzenet lesz (nem „[object Object]")', () => {
    const h = new ApiHiba(400, 'Érvénytelen bemenet', [
      { code: 'invalid_string', validation: 'url', path: ['celKulsoLink'], message: 'Invalid url' },
    ]);
    expect(hibaSzoveg(h)).toBe('Hibás adat — Külső link: érvénytelen webcím (https://… formában add meg)');
  });

  it('a Fastify-validáció becsomagolt issue-ját is érti', () => {
    const r = reszletekSzoveg([
      { keyword: 'too_small', instancePath: '/cim', message: 'x', params: { issue: { code: 'too_small', type: 'string', minimum: 1, path: ['cim'] } } },
    ]);
    expect(r).toBe('Cím: kötelező megadni');
  });

  it('szöveglista-részleteket összefűz, az üzenetet megtartja', () => {
    expect(hibaSzoveg(new ApiHiba(409, 'A kapcsolat nem vehető fel', ['Ciklus keletkezne.']))).toBe(
      'A kapcsolat nem vehető fel (Ciklus keletkezne.)',
    );
  });

  it('hálózati és parse-hibánál nem a nyers angol szöveg jelenik meg', () => {
    expect(hibaSzoveg(new TypeError('Failed to fetch'))).toMatch(/nem érhető el/);
    expect(hibaSzoveg(new SyntaxError("Unexpected token '<'"))).toMatch(/váratlan választ/);
    expect(hibaSzoveg(undefined)).toMatch(/Váratlan hiba/);
  });

  it('státusz alapján magyar üzenet, ha a válasz nem JSON', () => {
    expect(statuszSzoveg(502)).toMatch(/átmenetileg nem érhető el \(HTTP 502\)/);
    expect(statuszSzoveg(413)).toMatch(/túl nagy/);
  });
});
