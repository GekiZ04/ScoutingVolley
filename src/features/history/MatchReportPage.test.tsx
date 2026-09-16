import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione, salvaSostituzione, salvaTimeout } from '@/db/scouting';
import { MatchReportPage } from './MatchReportPage';

describe('MatchReportPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
    await db.sostituzioni.clear();
    await db.timeouts.clear();
  });

  it('mostra il punteggio finale del set e il box score derivati dalle azioni salvate', async () => {
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
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    await db.matches.update(match.id, { stato: 'conclusa' });

    render(
      <MemoryRouter initialEntries={[`/storico/${match.id}`]}>
        <Routes>
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('riepilogo-set-1')).toHaveTextContent('Set 1: 1 - 0');
    expect(await screen.findByTestId(`box-${giocatoreA1.id}-battuta`)).toHaveTextContent('100% (1)');
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
});
