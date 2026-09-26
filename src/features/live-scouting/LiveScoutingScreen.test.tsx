import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { LiveScoutingScreen } from './LiveScoutingScreen';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  const giocatori = [];
  for (let i = 1; i <= 6; i += 1) {
    giocatori.push(await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' }));
  }
  return giocatori;
}

// Verifica la via "derivata dalla ricezione" per l'ace: dopo origine/
// destinazione della battuta, tocca direttamente chi riceve (invece del tap
// diretto Ace #) e chiude con una ricezione in errore totale (valutazione '=').
async function registraAcePerSquadraAlServizio(
  user: ReturnType<typeof userEvent.setup>,
  giocatoreRicevente: { id: string },
) {
  await screen.findByText('Flottante');
  await user.click(screen.getByText('Flottante'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });

  const markerRicevente = `giocatore-campo-${giocatoreRicevente.id}`;
  await waitFor(() => expect(screen.getByTestId(markerRicevente)).toHaveAttribute('data-attivo', 'true'));
  await user.click(screen.getByTestId(markerRicevente));
  await user.click(await screen.findByTestId('ricezione-valutazione-='));
}

async function contaRighe(tabella: string): Promise<number> {
  const { data } = await supabase.from(tabella).select('*');
  return data?.length ?? 0;
}

describe('LiveScoutingScreen', () => {
  beforeEach(() => {
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
    expect(screen.getByTestId('indicatore-set')).toHaveTextContent('Set 1 / 5');
    expect(screen.getByTestId('indicatore-set')).not.toHaveTextContent('decisivo');

    await user.click(screen.getByRole('button', { name: 'Punto A' }));
    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
  });

  it('segnala il set decisivo quando il numero del set corrisponde al formato', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 3,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const indicatore = await screen.findByTestId('indicatore-set');
    expect(indicatore).toHaveTextContent('Set 3 / 3');
    expect(indicatore).toHaveTextContent('decisivo');
  });

  it('mostra a lato l\'efficienza attacco combinata (attacco+contrattacco) della prima linea attuale', async () => {
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
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('punteggio');

    // A2 e' in zona2 (indice1, prima linea): un attacco perfetto e uno
    // murato per punto (contrattacco, stesso rally) danno 0% su 2 tentativi.
    await act(async () => {
      await useLiveMatchStore.getState().registraAzione({
        squadra: 'A', giocatoreId: giocatoriA[1].id, fondamentale: 'attacco', tipoBattuta: null,
        valutazione: '#', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
      });
    });

    const pannello = await screen.findByTestId('efficienza-prima-linea');
    expect(within(pannello).getByText(`#${giocatoriA[1].numero} ${giocatoriA[1].nome}`)).toBeInTheDocument();
    expect(pannello).toHaveTextContent('100% (1)');
    // A1 e' in zona1 (seconda linea, serve): non deve comparire nel pannello.
    expect(within(pannello).queryByText(`#${giocatoriA[0].numero} ${giocatoriA[0].nome}`)).not.toBeInTheDocument();
  });

  it('mostra il libero al posto del centrale di seconda linea (cambio automatico)', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const libero = await aggiungiGiocatore({ teamId: squadraA.id, numero: 7, nome: 'Libero', ruolo: 'libero' });
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    // Palleggiatore = A1 in P1 (indice0). Giro schiacciatore-centrale:
    // P,S,C,O,S,C -> centrali agli offset 2 e 5, cioe' indice2 (zona3, a
    // rete: A3 resta visibile) e indice5 (zona6, seconda linea: A6 va
    // sostituito dal libero fin da subito, senza bisogno di rotazioni).
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
      paleggiatoreIdA: giocatoriA[0].id,
      giroA: 'schiacciatore-centrale',
    });

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const rotazioneA = await screen.findByTestId('rotazione-a');
    expect(rotazioneA).toHaveTextContent('P3: #3 A3');
    expect(rotazioneA).toHaveTextContent(`P6: #7 ${libero.nome}`);
    expect(rotazioneA).not.toHaveTextContent('A6');
    expect(screen.getByTestId(`giocatore-campo-${libero.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`giocatore-campo-${giocatoriA[5].id}`)).not.toBeInTheDocument();
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
    expect(await contaRighe('azioni')).toBe(2);
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
    expect(await contaRighe('azioni')).toBe(4);
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
    const { data: setAggiornato } = await supabase.from('sets').select('*').eq('id', set.id).maybeSingle();
    expect(setAggiornato?.stato).toBe('concluso');
    expect(setAggiornato?.vincitore).toBe('A');
    expect(confirmSpy).toHaveBeenCalledWith('Sei sicuro di voler chiudere il set?');
    expect(useLiveMatchStore.getState().set).toBeNull();

    confirmSpy.mockRestore();
  });

  it('mostra la notifica di partita decisa quando il set appena chiuso raggiunge i set necessari, e permette di chiudere la partita', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set1 = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    await aggiornaStatoSet(set1.id, 'concluso', 'A');
    const set2 = await creaSet({
      matchId: match.id, numero: 2,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set2.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
          <Route path="/storico" element={<div>Storico</div>} />
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
    await user.click(within(banner).getByRole('button', { name: 'Chiudi set' }));

    const modale = await screen.findByTestId('modal-partita-decisa');
    expect(modale).toHaveTextContent('Squadra A ha vinto la partita');
    expect(modale).toHaveTextContent('2 - 0');

    await user.click(within(modale).getByRole('button', { name: 'Chiudi partita' }));

    expect(await screen.findByText('Storico')).toBeInTheDocument();
    const { data: partitaAggiornata } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
    expect(partitaAggiornata?.stato).toBe('conclusa');

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

    const { data: setInvariato } = await supabase.from('sets').select('*').eq('id', set.id).maybeSingle();
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

    const { data: partitaAggiornata } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
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
    expect(await contaRighe('timeouts')).toBe(1);
  });
});
