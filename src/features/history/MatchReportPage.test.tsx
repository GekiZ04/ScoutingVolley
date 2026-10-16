import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
import { salvaRally, salvaAzione, salvaSostituzione, salvaTimeout } from '@/db/scouting';
import { MatchReportPage } from './MatchReportPage';

describe('MatchReportPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra set vinti e parziali derivati dalle azioni salvate', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '+',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await salvaAzione({
      id: 'az2', rallyId: 'r1', setId: set.id, ordine: 2, squadra: 'B', giocatoreId: 'b1',
      fondamentale: 'ricezione', tipoBattuta: null, valutazione: '=',
      origine: { x: 50, y: 50 }, destinazione: null, toccoMuro: false,
      timestamp: '2026-09-16T10:00:01.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    await aggiornaStatoPartita(match.id, 'conclusa');

    render(
      <MemoryRouter initialEntries={[`/storico/${match.id}`]}>
        <Routes>
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('parziali')).toHaveTextContent('1-0');
    expect(screen.getByTestId('set-vinti')).toHaveTextContent('1 - 0');
  });

  it('mostra un messaggio se la partita non esiste', async () => {
    render(
      <MemoryRouter initialEntries={['/storico/id-inesistente']}>
        <Routes>
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Partita non trovata.')).toBeInTheDocument();
  });

  it('elenca sostituzioni e timeout registrati per set', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const giocatoreA2 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 2, nome: 'A2', ruolo: 'libero' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaSostituzione({
      id: 'sost1', setId: set.id, dopoRallyNumero: 5, squadra: 'A',
      giocatoreEsceId: giocatoreA1.id, giocatoreEntraId: giocatoreA2.id,
    });
    await salvaTimeout({ id: 'to1', setId: set.id, dopoRallyNumero: 8, squadra: 'B' });

    render(
      <MemoryRouter initialEntries={[`/storico/${match.id}`]}>
        <Routes>
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('sostituzione-sost1')).toHaveTextContent(
      'Set 1: sostituzione squadra A, giocatore #1 A1 → #2 A2 (dopo rally 5)',
    );
    expect(await screen.findByTestId('timeout-to1')).toHaveTextContent(
      'Set 1: timeout squadra B (dopo rally 8)',
    );
  });

  async function preparaPartita(concludi: boolean) {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    if (concludi) await aggiornaStatoSet(set.id, 'concluso', 'A');
    return { match, set };
  }

  function montaScheda(matchId: string) {
    render(
      <MemoryRouter initialEntries={[`/storico/${matchId}`]}>
        <Routes>
          <Route path="/storico" element={<div>Archivio</div>} />
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting ripreso</div>} />
          <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
          <Route path="/partite/:matchId/tabellino" element={<div>Tabellino</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('scheda: Rilevazione riapre lo scout', async () => {
    const { match, set } = await preparaPartita(false);
    const user = userEvent.setup();
    montaScheda(match.id);
    await user.click(await screen.findByRole('button', { name: 'Rilevazione' }));
    expect(await screen.findByText('Scouting ripreso')).toBeInTheDocument();
    expect(set.id).toBeTruthy();
  });

  it('scheda: Rilevazione dopo un set concluso porta alla formazione', async () => {
    const { match } = await preparaPartita(true);
    const user = userEvent.setup();
    montaScheda(match.id);
    await user.click(await screen.findByRole('button', { name: 'Rilevazione' }));
    expect(await screen.findByText('Formazione')).toBeInTheDocument();
  });

  it('scheda: Analisi apre il tabellino', async () => {
    const { match } = await preparaPartita(true);
    const user = userEvent.setup();
    montaScheda(match.id);
    await user.click(await screen.findByRole('button', { name: 'Analisi' }));
    expect(await screen.findByText('Tabellino')).toBeInTheDocument();
  });

  it('scheda: Esporta apre il menu con i 4 export', async () => {
    const { match } = await preparaPartita(true);
    const user = userEvent.setup();
    montaScheda(match.id);
    expect(screen.queryByRole('button', { name: 'Esporta PDF' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Esporta' }));
    for (const nome of ['Esporta CSV azioni', 'Esporta CSV box score', 'Esporta PDF', 'Esporta Excel statistiche']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
  });

  it('scheda: elimina dopo la conferma e torna allarchivio', async () => {
    const { match } = await preparaPartita(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    montaScheda(match.id);
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Archivio')).toBeInTheDocument();
  });

  it('scheda: non elimina se si annulla la conferma', async () => {
    const { match } = await preparaPartita(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    montaScheda(match.id);
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(screen.queryByText('Archivio')).not.toBeInTheDocument();
  });
});
