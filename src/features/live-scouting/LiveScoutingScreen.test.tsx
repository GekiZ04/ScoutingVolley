import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { LiveScoutingScreen } from './LiveScoutingScreen';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  const giocatori = [];
  for (let i = 1; i <= 6; i += 1) {
    giocatori.push(await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' }));
  }
  return giocatori;
}

describe('LiveScoutingScreen', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
    useLiveMatchStore.setState({ set: null, rallies: [], azioni: [], sostituzioni: [], timeouts: [] });
  });

  it('mostra punteggio 0:0, la formazione titolare e aggiorna il punteggio con la chiusura manuale', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('punteggio')).toHaveTextContent('0 : 0');
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P1: #1 A1');
    expect(screen.getByText('Flottante')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Punto A' }));
    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
  });

  it('completa il tap-flow della battuta e registra unazione che aggiorna il punteggio', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleDirezione[0]);

    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
    expect(await db.azioni.count()).toBe(1);
  });

  it('esegue una sostituzione e aggiorna la formazione in campo mostrata', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const liberoPanchina = await aggiungiGiocatore({ teamId: squadraA.id, numero: 15, nome: 'Libero1', ruolo: 'libero' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('punteggio');
    await user.click(screen.getByRole('button', { name: 'Sostituzione' }));
    await screen.findByTestId('modal-sostituzione');
    await user.selectOptions(screen.getByLabelText('Esce'), giocatoriA[2].id);
    await user.selectOptions(screen.getByLabelText('Entra'), liberoPanchina.id);
    await user.click(screen.getByRole('button', { name: 'Conferma' }));

    expect(screen.queryByTestId('modal-sostituzione')).not.toBeInTheDocument();
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P3: #15 Libero1');
  });

  it('mostra il banner di fine set al raggiungimento del punteggio target e permette di chiuderlo', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
          <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('punteggio');
    await act(async () => {
      for (let i = 0; i < 25; i += 1) {
        await useLiveMatchStore.getState().chiudiRallyManuale('punto_A');
      }
    });

    const banner = await screen.findByTestId('banner-fine-set');
    expect(banner).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(within(banner).getByRole('button', { name: 'Chiudi set' }));

    expect(await screen.findByText('Formazione')).toBeInTheDocument();
    const setAggiornato = await db.sets.get(set.id);
    expect(setAggiornato?.stato).toBe('concluso');
    expect(setAggiornato?.vincitore).toBe('A');
  });

  it('chiude la partita e ne aggiorna lo stato', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('punteggio');
    await user.click(screen.getByRole('button', { name: 'Chiudi partita' }));

    const partitaAggiornata = await db.matches.get(match.id);
    expect(partitaAggiornata?.stato).toBe('conclusa');
  });
});
