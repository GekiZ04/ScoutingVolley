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
      creaAzione({ id: 'az1', rallyId: 'r1', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '#' }),
      creaAzione({ id: 'az2', rallyId: 'r2', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '=' }),
    ];
    render(
      <StatsPanel
        azioni={azioni}
        giocatoriA={[{ id: 'p1', teamId: 't', numero: 9, nome: 'Neri', ruolo: 'schiacciatore', attivo: true }]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('stat-p1-attacco')).toHaveTextContent('0% (2)');
    expect(screen.getByTestId('stat-p1-battuta')).toHaveTextContent('—');
  });

  it('separa il contrattacco (secondo attacco dello stesso rally) dall attacco', () => {
    const azioni = [
      creaAzione({ id: 'az1', rallyId: 'r1', ordine: 1, giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '#' }),
      creaAzione({ id: 'az2', rallyId: 'r1', ordine: 2, giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '+' }),
    ];
    render(
      <StatsPanel
        azioni={azioni}
        giocatoriA={[{ id: 'p1', teamId: 't', numero: 9, nome: 'Neri', ruolo: 'schiacciatore', attivo: true }]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('stat-p1-attacco')).toHaveTextContent('(1)');
    expect(screen.getByTestId('stat-p1-contrattacco')).toHaveTextContent('(1)');
  });
});
