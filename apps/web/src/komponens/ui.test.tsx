import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatuszJelveny, Modal } from './ui';

describe('StatuszJelveny', () => {
  it('a státuszt FELIRATTAL jeleníti meg (nem csak színnel)', () => {
    render(<StatuszJelveny statusz="Hatályos" />);
    expect(screen.getByText('Hatályos')).toBeInTheDocument();
  });

  it('minden státuszhoz van olvasható felirat', () => {
    const { rerender } = render(<StatuszJelveny statusz="Vázlat" />);
    expect(screen.getByText('Vázlat')).toBeInTheDocument();
    rerender(<StatuszJelveny statusz="Elvetve" />);
    expect(screen.getByText('Elvetve')).toBeInTheDocument();
  });
});

describe('Modal akadálymentesség', () => {
  it('dialógus szerepkörrel és címkével jelenik meg, Escape bezárja', () => {
    const onBezar = vi.fn();
    render(
      <Modal cim="Teszt modál" onBezar={onBezar}>
        <button>Egy</button>
      </Modal>,
    );
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveAttribute('aria-label', 'Teszt modál');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBezar).toHaveBeenCalled();
  });

  it('megnyitáskor az első fókuszálható elemre kerül a fókusz', () => {
    render(
      <Modal cim="Fókusz" onBezar={() => {}}>
        <button>Első gomb</button>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByText('Első gomb'));
  });
});
