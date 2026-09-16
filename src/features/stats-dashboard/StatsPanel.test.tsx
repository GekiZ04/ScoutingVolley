import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsPanel } from './StatsPanel';
import type { Azione } from '@/domain/types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('StatsPanel', () => {
  it('mostra efficienza e tentativi per fondamentale e giocatore', () => {
    const azioni = [
      creaAzione({ id: 'az1', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '#' }),
      creaAzione({ id: 'az2', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '=' }),
    ];
    render(
      <StatsPanel
        azioni={azioni}
        giocatoriA={[{ id: 'p1', numero: 9, nome: 'Neri' }]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('stat-p1-attacco')).toHaveTextContent('0% (2)');
    expect(screen.getByTestId('stat-p1-battuta')).toHaveTextContent('—');
  });
});
