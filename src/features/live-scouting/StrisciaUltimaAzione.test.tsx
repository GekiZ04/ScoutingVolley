import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrisciaUltimaAzione } from './StrisciaUltimaAzione';
import type { Azione } from '@/domain/types';

const azione: Azione = {
  id: 'az1', rallyId: 'r1', setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'a7',
  fondamentale: 'attacco', tipoBattuta: null, valutazione: '+',
  origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
  timestamp: '2026-09-22T10:00:00.000Z',
};

describe('StrisciaUltimaAzione', () => {
  it('mostra fondamentale, numero e nome del giocatore e valutazione applicata', () => {
    render(<StrisciaUltimaAzione azione={azione} etichettaGiocatore="#7 Verdi" onCorreggi={vi.fn()} />);
    const striscia = screen.getByTestId('striscia-ultima-azione');
    expect(striscia).toHaveTextContent('attacco #7 Verdi: +');
  });

  it('non mostra mai il codice interno del giocatore', () => {
    render(<StrisciaUltimaAzione azione={azione} onCorreggi={vi.fn()} />);
    expect(screen.getByTestId('striscia-ultima-azione')).not.toHaveTextContent('a7');
  });

  it('mostra un bottone di correzione per ogni valutazione diversa da quella applicata, e chiama onCorreggi al tap', async () => {
    const onCorreggi = vi.fn();
    const user = userEvent.setup();
    render(<StrisciaUltimaAzione azione={azione} onCorreggi={onCorreggi} />);

    expect(screen.queryByTestId('correggi-valutazione-+')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/correggi-valutazione-/)).toHaveLength(5);

    await user.click(screen.getByTestId('correggi-valutazione-#'));
    expect(onCorreggi).toHaveBeenCalledWith('#');
  });
});
