import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaAzione } from '@/db/scouting';
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

  it('mostra la pallina accanto a chi e al servizio e la sposta quando cambia il servizio', async () => {
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
    expect(screen.getByTestId('indicatore-servizio-a')).toHaveTextContent('🏐');
    expect(screen.getByTestId('indicatore-servizio-b')).toHaveTextContent('');

    // B vince il rally mentre A serviva: side-out, ora serve B.
    await user.click(screen.getByRole('button', { name: 'Punto B' }));

    await waitFor(() => expect(screen.getByTestId('indicatore-servizio-b')).toHaveTextContent('🏐'));
    expect(screen.getByTestId('indicatore-servizio-a')).toHaveTextContent('');
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

  it('mostra a lato l\'efficienza attacco combinata della seconda linea attuale', async () => {
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

    // A5 e' in zona5 (indice4, seconda linea): un contrattacco da dietro
    // andato a punto da' 100% su 1 tentativo.
    await act(async () => {
      await useLiveMatchStore.getState().registraAzione({
        squadra: 'A', giocatoreId: giocatoriA[4].id, fondamentale: 'attacco', tipoBattuta: null,
        valutazione: '#', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
      });
    });

    const pannello = await screen.findByTestId('efficienza-seconda-linea');
    expect(within(pannello).getByText(`#${giocatoriA[4].numero} ${giocatoriA[4].nome}`)).toBeInTheDocument();
    expect(pannello).toHaveTextContent('100% (1)');
    // A2 e' in zona2 (prima linea): non deve comparire nel pannello di seconda linea.
    expect(within(pannello).queryByText(`#${giocatoriA[1].numero} ${giocatoriA[1].nome}`)).not.toBeInTheDocument();
  });

  it('la distribuzione del palleggio resta cumulata tra i set, non solo quello in corso', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set1 = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    // Un attacco gia' registrato nel set 1 (gia' concluso, non e' quello
    // caricato in questa schermata).
    await salvaAzione({
      id: 'az-set1', rallyId: 'r-set1', setId: set1.id, ordine: 1, squadra: 'A',
      giocatoreId: giocatoriA[1].id, fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
      origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });

    const set2 = await creaSet({
      matchId: match.id, numero: 2,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set2.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('punteggio');

    // Un secondo attacco, questa volta nel set 2 (quello in corso), da un
    // altro giocatore.
    await act(async () => {
      await useLiveMatchStore.getState().registraAzione({
        squadra: 'A', giocatoreId: giocatoriA[2].id, fondamentale: 'attacco', tipoBattuta: null,
        valutazione: '#', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
      });
    });

    const pannello = await screen.findByTestId('distribuzione-palleggio');
    // Entrambi i giocatori compaiono, uno per set: 50%/50% sul totale partita.
    await waitFor(() => {
      expect(within(pannello).getByText(`#${giocatoriA[1].numero} ${giocatoriA[1].nome}`)).toBeInTheDocument();
    });
    expect(within(pannello).getByText(`#${giocatoriA[2].numero} ${giocatoriA[2].nome}`)).toBeInTheDocument();
    expect(pannello).toHaveTextContent('50% (1)');
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

  it('cambia il centrale in zona 1 col libero appena la squadra perde il servizio, senza aspettare la rotazione', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const libero = await aggiungiGiocatore({ teamId: squadraA.id, numero: 7, nome: 'Libero', ruolo: 'libero' });
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    // Palleggiatore (A1) in P5 (indice4): coi centrali a offset 2 e 5 dal
    // palleggiatore, finiscono a indice0 (zona1, A2) e indice3 (zona4, A5).
    // A al servizio: A2 deve poter battere, quindi resta visibile (non e'
    // ancora "seconda linea che riceve").
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [
        giocatoriA[1].id, giocatoriA[2].id, giocatoriA[3].id, giocatoriA[4].id, giocatoriA[0].id, giocatoriA[5].id,
      ],
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
    expect(rotazioneA).toHaveTextContent('P1: #2 A2');

    // B vince il rally mentre A serviva: side-out a B, A NON ruota (la sua
    // formazione resta identica), ma A2 non deve piu' battere in questo
    // rally: il libero deve gia' prendere il suo posto in P1.
    await act(async () => {
      await useLiveMatchStore.getState().chiudiRallyManuale('punto_B');
    });

    expect(await screen.findByTestId('punteggio')).toHaveTextContent('0 : 1');
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent(`P1: #7 ${libero.nome}`);
    expect(screen.getByTestId('rotazione-a')).not.toHaveTextContent('A2');
    // Nessuna rotazione reale: gli altri titolari di A restano negli stessi slot.
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P4: #5 A5');
  });

  it('con 2 liberi in rosa chiede quale e entrato quando scatta il cambio automatico, poi permette di scambiarli', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const libero1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 7, nome: 'Libero1', ruolo: 'libero' });
    const libero2 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 8, nome: 'Libero2', ruolo: 'libero' });
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    // Stessa formazione del test sopra (A6 in zona6, cambio automatico
    // attivo da subito), ma qui la squadra ha 2 liberi in rosa: nessuna
    // scelta pregressa (il roster ne ha solo 2, sotto la soglia dei 3 che fa
    // scattare "Scegli i liberi"), quindi serve chiederlo in live.
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
      paleggiatoreIdA: giocatoriA[0].id,
      giroA: 'schiacciatore-centrale',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const modale = await screen.findByTestId('modal-scelta-libero');
    expect(modale).toHaveTextContent('Squadra A');
    await user.click(within(modale).getByRole('button', { name: `#${libero1.numero} ${libero1.nome}` }));

    expect(screen.queryByTestId('modal-scelta-libero')).not.toBeInTheDocument();
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P6: #7 Libero1');

    // Il pulsante di scambio, esterno alla sostituzione classica, alterna
    // sull'altro libero senza passare da aggiungiSostituzione.
    await user.click(screen.getByTestId('scambia-libero-a'));
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent(`P6: #${libero2.numero} ${libero2.nome}`);
    expect(screen.getByTestId('sostituzioni-a')).toHaveTextContent('Sostituzioni A: 0/6');

    await user.click(screen.getByTestId('scambia-libero-a'));
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P6: #7 Libero1');
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
    expect(screen.getByTestId('sostituzioni-a')).toHaveTextContent('Sostituzioni A: 0/6');
    await user.click(screen.getByRole('button', { name: 'Sostituzione' }));
    await screen.findByTestId('modal-sostituzione');
    await user.selectOptions(screen.getByLabelText('Esce'), giocatoriA[2].id);
    await user.selectOptions(screen.getByLabelText('Entra'), liberoPanchina.id);
    await user.click(screen.getByRole('button', { name: 'Conferma' }));

    expect(screen.queryByTestId('modal-sostituzione')).not.toBeInTheDocument();
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P3: #15 Libero1');
    expect(await screen.findByTestId('sostituzioni-a')).toHaveTextContent('Sostituzioni A: 1/6');
    expect(screen.getByTestId('sostituzioni-b')).toHaveTextContent('Sostituzioni B: 0/6');
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

    // Ricezione totalmente in errore ('=') -> ace, la battuta appaiata viene
    // derivata a '#' (vedi derivaValutazioneBattutaDaRicezione).
    expect(await screen.findByTestId(`stat-${giocatoriA[0].id}-battuta`)).toHaveTextContent('Pt 1 / Err 0');
  });

  it('dopo un attacco toccato dal muro, la striscia di correzione mostra e corregge l attacco (non il muro auto-derivato)', async () => {
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

    // Stessa coppia attacco+muro che registra AttaccoMuroFlow su un tap
    // nella zona rossa (valutazione di default '+' -> muro '!').
    await act(async () => {
      await useLiveMatchStore.getState().registraDueAzioni(
        {
          squadra: 'A', giocatoreId: giocatoriA[0].id, fondamentale: 'attacco', tipoBattuta: null,
          valutazione: '+', origine: { x: 30, y: 30 }, destinazione: { x: 52, y: 40 }, toccoMuro: true,
        },
        {
          squadra: 'B', giocatoreId: null, fondamentale: 'muro', tipoBattuta: null,
          valutazione: '!', origine: { x: 52, y: 40 }, destinazione: { x: 52, y: 40 }, toccoMuro: false,
        },
      );
    });

    const striscia = await screen.findByTestId('striscia-ultima-azione');
    expect(striscia).toHaveTextContent('attacco');
    expect(striscia).not.toHaveTextContent('muro');

    await user.click(within(striscia).getByTestId('correggi-valutazione-#'));

    await waitFor(() => {
      const azioni = useLiveMatchStore.getState().azioni;
      expect(azioni.find((a) => a.fondamentale === 'attacco')?.valutazione).toBe('#');
      expect(azioni.find((a) => a.fondamentale === 'muro')?.valutazione).toBe('=');
    });
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
