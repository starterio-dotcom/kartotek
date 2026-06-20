import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { StatuszJelveny, Modal, Hiba, Betolto } from './ui';
import { Markdown } from './Markdown';

/**
 * Automatizált akadálymentesség-audit (axe-core) a CI-ban futó komponensekre.
 * A színkontraszt-szabály ki van kapcsolva (happy-dom-ban nincs valódi layout/szín);
 * a strukturális szabályok (szerepkörök, címkék, alt, aria, gomb-név) érvényesek.
 */
async function auditNincsSertes(elem: HTMLElement) {
  const eredmeny = await axe.run(elem, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  // Olvasható hibák, ha lenne sértés.
  expect(
    eredmeny.violations.map((v) => `${v.id}: ${v.help}`),
  ).toEqual([]);
}

describe('akadálymentesség (axe-core)', () => {
  it('StatuszJelveny — státusz felirattal, sértés nélkül', async () => {
    const { container } = render(<StatuszJelveny statusz="Hatályos" />);
    await auditNincsSertes(container);
  });

  it('Modal — dialógus szerepkör + címke, fókuszálható tartalom', async () => {
    const { container } = render(
      <Modal cim="Teszt dialógus" onBezar={() => {}}>
        <label>
          Mező
          <input />
        </label>
        <button>Mentés</button>
      </Modal>,
    );
    await auditNincsSertes(container);
  });

  it('Hiba + Betöltő — élő régiók szerepkörrel', async () => {
    const { container } = render(
      <div>
        <Hiba uzenet="Hiba történt" />
        <Betolto />
      </div>,
    );
    await auditNincsSertes(container);
  });

  it('Markdown-render — szemantikus tartalom', async () => {
    const { container } = render(
      <Markdown szoveg={'## Cím\n\nBekezdés **félkövér** szöveggel.\n\n- egy\n- kettő'} />,
    );
    await auditNincsSertes(container);
  });
});
