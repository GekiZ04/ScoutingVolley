import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VistaRotazione } from './VistaRotazione';
import type { DatiSetRotazioni } from '@/domain/rotazioni';
import type { Azione, Player, Rally, SetPallavolo } from '@/domain/types';

const set: SetPallavolo = {
  id: 'set1', matchId: 'm1', numero: 1,
  formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
  formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
  primaSquadraAlServizio: 'B', stato: 'in_corso', vincitore: null,
  paleggiatoreIdA: 'a1', paleggiatoreIdB: null, giroA: null, giroB: null,
};
const rallies: Rally[] = [
  { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'B', esito: null, chiusuraManuale: false },
  { id: 'r2', setId: 'set1', numero: 2, squadraAlServizio: 'A', esito: null, chiusuraManuale: false },
];
function az(id: string, rallyId: string, ordine: number, o: Partial<Azione>): Azione {
  return {
    id, rallyId, setId: 'set1', ordine, squadra: 'A', giocatoreId: 'a2', fondamentale: 'attacco',
    tipoBattuta: null, valutazione: '#', origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 },
    toccoMuro: false, timestamp: '2026-09-16T10:00:00.000Z', ...o,
  };
}
const azioni: Azione[] = [
  az('b1', 'r1', 1, { squadra: 'B', giocatoreId: 'b1', fondamentale: 'battuta', valutazione: '+' }),
  az('ric1', 'r1', 2, { fondamentale: 'ricezione', valutazione: '+', giocatoreId: 'a3' }),
  az('att1', 'r1', 3, {}),
  az('b2', 'r2', 1, { fondamentale: 'battuta', valutazione: '+' }),
  az('ric2', 'r2', 2, { squadra: 'B', giocatoreId: 'b2', fondamentale: 'ricezione', valutazione: '+' }),
  az('attB', 'r2', 3, { squadra: 'B', giocatoreId: 'b2', valutazione: '+' }),
  az('con', 'r2', 4, {}),
];
const dati: DatiSetRotazioni[] = [{ set, rallies, azioni, sostituzioni: [] }];
const giocatori: Player[] = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id, i) => ({
  id, teamId: 'tA', numero: i + 1, nome: id, ruolo: 'schiacciatore', attivo: true,
}));

describe('VistaRotazione', () => {
  it('cambia filtro e zona', async () => {
    const utente = userEvent.setup();
    render(
      <VistaRotazione
        squadra="A" nomeSquadra="Casa" giocatori={giocatori} dati={dati} zonaIniziale={1} onChiudi={() => {}}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Casa – P1');
    expect(screen.getAllByTestId('traiettoria-extra')).toHaveLength(1);
    await utente.click(screen.getByRole('button', { name: 'Contrattacco' }));
    expect(screen.queryAllByTestId('traiettoria-extra')).toHaveLength(0);
    await utente.click(screen.getByRole('button', { name: 'P6' }));
    expect(screen.getByRole('heading')).toHaveTextContent('Casa – P6');
    expect(screen.getAllByTestId('traiettoria-extra')).toHaveLength(1);
  });
});
