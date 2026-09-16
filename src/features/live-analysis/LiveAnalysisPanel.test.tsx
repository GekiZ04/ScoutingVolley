import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveAnalysisPanel } from './LiveAnalysisPanel';
import type { Azione, Player } from '@/domain/types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

function creaGiocatore(overrides: Partial<Player>): Player {
  return { id: 'p1', teamId: 't1', numero: 9, nome: 'Neri', ruolo: 'schiacciatore', attivo: true, ...overrides };
}

describe('LiveAnalysisPanel', () => {
  it('mostra il colpo principale per uno schiacciatore', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1' }),
      creaAzione({ id: 'a2', rallyId: 'r2', valutazione: '+' }),
      creaAzione({ id: 'a3', rallyId: 'r3', destinazione: { x: 70, y: 90 }, valutazione: '=' }),
    ];
    render(
      <LiveAnalysisPanel azioni={azioni} giocatoriA={[creaGiocatore({})]} giocatoriB={[]} onChiudi={() => {}} />,
    );
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('Colpo principale: parallela');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('parallela 67%');
  });

  it('mostra il breakdown per fascia laterale di destinazione per un centrale', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', destinazione: { x: 70, y: 50 } }),
      creaAzione({ id: 'a2', rallyId: 'r2', destinazione: { x: 70, y: 50 } }),
      creaAzione({ id: 'a3', rallyId: 'r3', destinazione: { x: 70, y: 90 } }),
    ];
    render(
      <LiveAnalysisPanel
        azioni={azioni}
        giocatoriA={[creaGiocatore({ ruolo: 'centrale' })]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('sinistra: 0%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('centro: 67%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('destra: 33%');
  });

  it('evidenzia la riga quando errori e murati superano la soglia di allerta', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', valutazione: '=' }),
      creaAzione({ id: 'a2', rallyId: 'r2', valutazione: '#' }),
    ];
    render(
      <LiveAnalysisPanel azioni={azioni} giocatoriA={[creaGiocatore({})]} giocatoriB={[]} onChiudi={() => {}} />,
    );
    const riga = screen.getByTestId('analisi-p1').closest('tr');
    expect(riga?.className).toContain('bg-red-900/40');
  });
});
