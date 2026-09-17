import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, within, fireEvent, waitFor } from '@testing-library/react';
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

// Una battuta "buona" non chiude più il rally da sola: l'ace si ottiene
// quando la ricezione avversaria è un errore totale (valutazione '=').
async function registraAcePerSquadraAlServizio(
  user: ReturnType<typeof userEvent.setup>,
  giocatoreRicevente: { id: string },
) {
  await screen.findByText('Flottante');
  await user.click(screen.getByText('Flottante'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });
  await user.click(screen.getByText('Buona'));

  const markerRicevente = `giocatore-campo-${giocatoreRicevente.id}`;
  await waitFor(() => expect(screen.getByTestId(markerRicevente)).toHaveAttribute('data-attivo', 'true'));
  await user.click(screen.getByTestId(markerRicevente));
  await user.click(screen.getByText('='));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 50 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 50 });
}

describe('LiveScoutingScreen', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
    await db.sostituzioni.clear();
    await db.timeouts.clear();
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

  it('completa il tap-flow battuta+ricezione e registra un ace che aggiorna il punteggio', async () => {
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

    await registraAcePerSquadraAlServizio(user, giocatoriB[0]);

    await waitFor(() => expect(screen.getByTestId('punteggio')).toHaveTextContent('1 : 0'));
    expect(await db.azioni.count()).toBe(2);
  });

  it('registra due ace consecutivi: il flusso riparte da capo dopo ogni chiusura di rally', async () => {
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

    await registraAcePerSquadraAlServizio(user, giocatoriB[0]);
    await waitFor(() => expect(screen.getByTestId('punteggio')).toHaveTextContent('1 : 0'));

    // Dopo il primo ace il passo atteso torna 'battuta' senza che il componente
    // BattutaFlow cambi tipo React: senza una key che forzi il remount, lo stato
    // interno (passo/tipoBattuta/scelte) resterebbe quello della battuta
    // precedente invece di ripartire da 'tipo'.
    await registraAcePerSquadraAlServizio(user, giocatoriB[0]);

    await waitFor(() => expect(screen.getByTestId('punteggio')).toHaveTextContent('2 : 0'));
    expect(await db.azioni.count()).toBe(4);
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

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

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
    expect(confirmSpy).toHaveBeenCalledWith('Sei sicuro di voler chiudere il set?');
    expect(useLiveMatchStore.getState().set).toBeNull();

    confirmSpy.mockRestore();
  });

  it('non chiude il set se la conferma viene annullata', async () => {
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
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId('punteggio');
    await user.click(screen.getByRole('button', { name: 'Punto A' }));
    await screen.findByTestId('punteggio');
    await user.click(screen.getByRole('button', { name: 'Chiudi set' }));

    const setInvariato = await db.sets.get(set.id);
    expect(setInvariato?.stato).toBe('in_corso');
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
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
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

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
    expect(confirmSpy).toHaveBeenCalledWith(
      'Sei sicuro di voler chiudere la partita? Non potrai più modificarla.',
    );

    confirmSpy.mockRestore();
  });

  it('apre il pannello statistiche e mostra le azioni registrate', async () => {
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

    await registraAcePerSquadraAlServizio(user, giocatoriB[0]);
    await waitFor(() => expect(screen.getByTestId('punteggio')).toHaveTextContent('1 : 0'));

    await user.click(screen.getByRole('button', { name: 'Statistiche' }));

    // La battuta non viene più valutata in modo puntuale (solo errore/buona),
    // quindi una battuta "buona" ha efficienza 0%, non più 100% come quando
    // l'ace veniva marcato come valutazione '#' sulla battuta stessa.
    expect(await screen.findByTestId(`stat-${giocatoriA[0].id}-battuta`)).toHaveTextContent('0% (1)');
  });

  it('apre il pannello Analisi live', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Analisi live' }));

    expect(await screen.findByTestId('pannello-analisi-live')).toBeInTheDocument();
  });

  it('mostra il contatore dei timeout usati per ciascuna squadra', async () => {
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
    expect(screen.getByTestId('timeout-a')).toHaveTextContent('Timeout A: 0/2');
    await user.click(screen.getByTestId('timeout-a'));
    expect(await screen.findByTestId('timeout-a')).toHaveTextContent('Timeout A: 1/2');
    expect(screen.getByTestId('timeout-b')).toHaveTextContent('Timeout B: 0/2');
    expect(await db.timeouts.count()).toBe(1);
  });
});
