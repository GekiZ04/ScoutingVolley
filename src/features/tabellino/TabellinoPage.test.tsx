import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import type { Squadra } from '@/domain/types';
import { TabellinoPage } from './TabellinoPage';
import { TabellinoSquadra } from './TabellinoSquadra';

async function preparaPartita() {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const a1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'Alfa', ruolo: 'schiacciatore' });
  const b1 = await aggiungiGiocatore({ teamId: squadraB.id, numero: 7, nome: 'Beta', ruolo: 'schiacciatore' });
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const formazioneA = [a1.id, 'a2', 'a3', 'a4', 'a5', 'a6'];
  const formazioneB = [b1.id, 'b2', 'b3', 'b4', 'b5', 'b6'];
  const set1 = await creaSet({ matchId: match.id, numero: 1, formazioneInizialeA: formazioneA, formazioneInizialeB: formazioneB, primaSquadraAlServizio: 'A' });
  const set2 = await creaSet({ matchId: match.id, numero: 2, formazioneInizialeA: formazioneA, formazioneInizialeB: formazioneB, primaSquadraAlServizio: 'B' });

  let ordine = 0;
  const punto = async (setId: string, n: number, vince: Squadra, giocatoreId: string, minuto: number, fond: 'attacco' | 'battuta' = 'attacco') => {
    const rallyId = `${setId}-r${n}`;
    await salvaRally({ id: rallyId, setId, numero: n, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: `${rallyId}-az`, rallyId, setId, ordine: ++ordine, squadra: vince, giocatoreId,
      fondamentale: fond, tipoBattuta: fond === 'battuta' ? 'flottante' : null, valutazione: '#',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
      timestamp: new Date(Date.UTC(2026, 8, 16, 10, minuto)).toISOString(),
    });
  };
  // Set 1: 6-8 al raggiungimento di 8 (ultimo punto di B), durata 1.07 (67 minuti)
  const sequenza: Squadra[] = ['A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'];
  for (let i = 0; i < sequenza.length; i++) {
    const s = sequenza[i];
    const minuto = i === 0 ? 0 : i === sequenza.length - 1 ? 67 : 1 + i;
    await punto(set1.id, i + 1, s, s === 'A' ? a1.id : b1.id, minuto, i === 0 ? 'battuta' : 'attacco');
  }
  // Set 2: due battute vincenti di A
  await punto(set2.id, 1, 'A', a1.id, 100, 'battuta');
  await punto(set2.id, 2, 'A', a1.id, 105, 'battuta');
  await aggiornaStatoSet(set1.id, 'concluso', 'B');
  return { match };
}

function monta(matchId: string) {
  return render(
    <MemoryRouter initialEntries={[`/partite/${matchId}/tabellino`]}>
      <Routes>
        <Route path="/partite/:matchId/tabellino" element={<TabellinoPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TabellinoPage', () => {
  it('mostra tabellino di entrambe le squadre con colonne Punti', async () => {
    const { match } = await preparaPartita();
    monta(match.id);
    expect(await screen.findByTestId('tabellino-A')).toBeInTheDocument();
    expect(screen.getByTestId('tabellino-B')).toBeInTheDocument();
    expect(screen.getAllByText('Volley Rossi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Volley Blu').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('tabellino-A')).getByText('Punti')).toBeInTheDocument();
    expect(within(screen.getByTestId('tabellino-A')).getByText('BP')).toBeInTheDocument();
  });

  it('il menu Set 1 filtra i numeri', async () => {
    const { match } = await preparaPartita();
    monta(match.id);
    const squadraA = await screen.findByTestId('tabellino-A');
    const totale = within(squadraA).getByTestId('totale-3'); // Battuta Tot
    expect(totale).toHaveTextContent('3'); // 1 battuta nel set 1 + 2 nel set 2
    await userEvent.selectOptions(screen.getByLabelText('Vista'), 'Set 1');
    expect(within(screen.getByTestId('tabellino-A')).getByTestId('totale-3')).toHaveTextContent('1');
  });

  it('mostra durata e parziali del set', async () => {
    const { match } = await preparaPartita();
    monta(match.id);
    expect(await screen.findByTestId('durata-set-1')).toHaveTextContent('1.07');
    expect(screen.getByTestId('parziale-set-1-8')).toHaveTextContent('6-8');
  });

  it('non conta come vinto un set ancora in corso', async () => {
    const { match } = await preparaPartita();
    monta(match.id);
    // Set 1 concluso (vince B); set 2 in corso con A avanti 2-0
    expect(await screen.findByTestId('risultato-set')).toHaveTextContent('Volley Rossi 0 - 1 Volley Blu');
  });
});

describe('TabellinoSquadra', () => {
  const vuoto = { batt: 0, att: 0, mur: 0, erAv: 0 };
  it('mostra celle Set, libero, cerchio prima battuta e righe Punti Vinti', () => {
    render(
      <TabellinoSquadra
        nomeSquadra="Squadra X"
        righe={[
          { numero: 5, nome: 'Palleggiatore', libero: false, valori: [], celleSet: [{ tipo: 'titolare', posizione: 3, palleggiatore: true }] },
          { numero: 6, nome: 'Schiacciatore', libero: false, valori: [], celleSet: [{ tipo: 'titolare', posizione: 4, palleggiatore: false }] },
          { numero: 7, nome: 'Subentrato', libero: false, valori: [], celleSet: [{ tipo: 'entrato' }] },
          { numero: 8, nome: 'Liberoo', libero: true, valori: [], celleSet: [null] },
        ]}
        totale={[]}
        puntiVinti={[{ etichetta: 'Set 1', valori: { batt: 1, att: 2, mur: 3, erAv: 4 } }, { etichetta: 'Totale', valori: vuoto }]}
        colonneSet={{ primaBattuta: [true, false, false, false, false] }}
      />,
    );
    const celle = screen.getAllByTestId('cella-set-1');
    expect(celle).toHaveLength(3);
    expect(celle[0]).toHaveTextContent('3');
    expect(celle[0]).toHaveClass('font-bold');
    expect(celle[1]).not.toHaveClass('font-bold');
    expect(celle[2]).toBeEmptyDOMElement();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByTestId('prima-battuta-set-1')).toHaveClass('rounded-full');
    expect(screen.queryByTestId('prima-battuta-set-2')).toBeNull();
    const riga = screen.getByText('Set 1').closest('tr') as HTMLElement;
    expect(within(riga).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Set 1', '1', '2', '3', '4']);
  });

  it('senza colonneSet non mostra colonne Set', () => {
    render(<TabellinoSquadra nomeSquadra="X" righe={[]} totale={[]} puntiVinti={[]} />);
    expect(screen.queryByText('Set')).toBeNull();
  });
});
