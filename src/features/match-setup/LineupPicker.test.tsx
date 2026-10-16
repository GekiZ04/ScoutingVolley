import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita } from '@/db/matches';
import { LineupPicker } from './LineupPicker';
import type { Player, SetPallavolo } from '@/domain/types';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  for (let i = 1; i <= 6; i += 1) {
    await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' });
  }
}

describe('LineupPicker', () => {
  it('crea il set con le due formazioni nellordine di tap e naviga alla schermata di scouting', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: squadraA.id,
      squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id,
      formatoSet: 5,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

    expect(await screen.findByText('Scouting avviato')).toBeInTheDocument();
    const { data: setRows } = await supabase.from('sets').select('*');
    const set = (setRows as SetPallavolo[])[0];
    const { data: giocatoriA } = await supabase.from('players').select('*').eq('teamId', squadraA.id).order('numero');
    expect(set.formazioneInizialeA).toEqual((giocatoriA as Player[]).map((p) => p.id));
  });

  it('un doppio tap su Inizia partita crea un solo set, non un set fantasma in piu', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    const bottone = screen.getByRole('button', { name: 'Inizia partita' });
    await Promise.all([user.click(bottone), user.click(bottone)]);

    await screen.findByText('Scouting avviato');
    const { data: setRows } = await supabase.from('sets').select('*');
    expect(setRows).toHaveLength(1);
  });

  it('assegna il numero 2 al secondo set della stessa partita', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await supabase.from('sets').insert({
      id: 'set-esistente', matchId: match.id, numero: 1,
      formazioneInizialeA: [], formazioneInizialeB: [], primaSquadraAlServizio: 'A',
      stato: 'concluso', vincitore: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

    await screen.findByText('Scouting avviato');
    const { data: setRows } = await supabase.from('sets').select('*');
    const nuovoSet = (setRows as SetPallavolo[]).find((s) => s.id !== 'set-esistente');
    expect(nuovoSet?.numero).toBe(2);
  });

  it('con piu di 2 liberi chiede quali 2 giocano prima di mostrare la formazione, ed esclude gli altri', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const libero1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'Lib1', ruolo: 'libero' });
    const libero2 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 2, nome: 'Lib2', ruolo: 'libero' });
    await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Lib3', ruolo: 'libero' });
    for (let i = 4; i <= 9; i += 1) {
      await aggiungiGiocatore({ teamId: squadraA.id, numero: i, nome: `A${i}`, ruolo: 'centrale' });
    }
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Scegli i liberi (max 2)')).toBeInTheDocument();
    expect(screen.queryByText(/Squadra B/)).not.toBeInTheDocument();
    await user.click(screen.getByText('#1 Lib1'));
    await user.click(screen.getByText('#2 Lib2'));
    await user.click(screen.getByRole('button', { name: 'Conferma liberi' }));

    expect(await screen.findByText('Formazione titolare')).toBeInTheDocument();
    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    expect(screen.queryByText(/#3 Lib3/)).not.toBeInTheDocument();
    // Anche i 2 liberi scelti non stanno tra i 6 titolari.
    expect(screen.queryByText(/#1 Lib1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/#2 Lib2/)).not.toBeInTheDocument();

    for (let i = 4; i <= 9; i += 1) {
      await user.click(screen.getByText(new RegExp(`#${i} A${i}`)));
    }
    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

    expect(await screen.findByText('Scouting avviato')).toBeInTheDocument();
    const { data: partitaAggiornata } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
    expect((partitaAggiornata?.liberiSelezionatiA as string[]).sort()).toEqual([libero1.id, libero2.id].sort());
  });

  it('gira la formazione di una squadra tenendo gli stessi giocatori, e il set parte con la formazione girata', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('ruota-b')).not.toBeInTheDocument();
    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }

    // B5 era in P5: una rotazione lo porta in P4, B1 finisce in P6.
    await user.click(screen.getByTestId('ruota-b'));
    expect(screen.getByTestId('cella-b-4')).toHaveTextContent('#5 B5');
    expect(screen.getByTestId('cella-b-6')).toHaveTextContent('#1 B1');
    // La squadra A non cambia.
    expect(screen.getByTestId('cella-a-5')).toHaveTextContent('#5 A5');

    // Sei rotazioni complete riportano la formazione com'era; poi una avanti netta.
    for (let i = 0; i < 5; i += 1) await user.click(screen.getByTestId('ruota-b'));
    expect(screen.getByTestId('cella-b-5')).toHaveTextContent('#5 B5');
    await user.click(screen.getByTestId('ruota-b'));

    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));
    expect(await screen.findByText('Scouting avviato')).toBeInTheDocument();

    const { data: setRows } = await supabase.from('sets').select('*');
    const set = (setRows as SetPallavolo[])[0];
    const { data: giocatoriB } = await supabase.from('players').select('*').eq('teamId', squadraB.id).order('numero');
    const idB = (giocatoriB as Player[]).map((p) => p.id);
    expect(set.formazioneInizialeB).toEqual([idB[1], idB[2], idB[3], idB[4], idB[5], idB[0]]);
  });

  it('il libero non si puo mettere tra i 6 titolari', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    await aggiungiGiocatore({ teamId: squadraA.id, numero: 10, nome: 'Libera', ruolo: 'libero' });
    const match = await creaPartita({
      data: '2026-10-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/#1 A1/)).toBeInTheDocument();
    expect(screen.queryByText(/#10 Libera/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/libero entra da solo/i).length).toBeGreaterThan(0);
  });

  async function montaConDueRoster() {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-10-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );
    return match;
  }

  it('la griglia riempie le zone 1..6 nellordine di tocco e toglie i giocatori dalla rosa', async () => {
    await montaConDueRoster();
    const user = userEvent.setup();

    await user.click(await screen.findByText(/#3 A3/));
    await user.click(screen.getByText(/#1 A1/));

    expect(screen.getByTestId('cella-a-1')).toHaveTextContent('#3 A3');
    expect(screen.getByTestId('cella-a-2')).toHaveTextContent('#1 A1');
    // Spariti dalla rosa: resta solo la copia nella casella.
    expect(screen.getAllByText(/#3 A3/)).toHaveLength(1);
    // La casella successiva e' evidenziata in giallo.
    expect(screen.getByTestId('cella-a-3').className).toMatch(/yellow/);
    expect(screen.getByTestId('cella-a-4').className).not.toMatch(/yellow/);
    // Reset svuota la griglia e riporta i giocatori in rosa.
    await user.click(screen.getByTestId('reset-a'));
    expect(screen.getByTestId('cella-a-1')).not.toHaveTextContent('#3 A3');
    expect(screen.getAllByText(/#3 A3/)).toHaveLength(1);
  });

  it('salva sul set palleggiatore e giro scelti per ciascuna squadra', async () => {
    const match = await montaConDueRoster();
    const user = userEvent.setup();
    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    // A: palleggiatore in zona 3 con giro P-C-S; B: palleggiatore in zona 2, giro di default.
    await user.click(screen.getByTestId('cella-a-3'));
    await user.click(screen.getAllByRole('button', { name: 'P-C-S' })[0]);
    await user.click(screen.getByTestId('cella-b-2'));
    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

    expect(await screen.findByText('Scouting avviato')).toBeInTheDocument();
    const { data: setRows } = await supabase.from('sets').select('*').eq('matchId', match.id);
    const set = (setRows as SetPallavolo[])[0];
    const { data: giocatori } = await supabase.from('players').select('*');
    const idDi = (nome: string) => (giocatori as Player[]).find((g) => g.nome === nome)!.id;
    expect(set).toMatchObject({
      paleggiatoreIdA: idDi('A3'),
      giroA: 'centrale-schiacciatore',
      paleggiatoreIdB: idDi('B2'),
      giroB: 'schiacciatore-centrale',
    });
  });

  it('toccare una casella piena cambia palleggiatore; P-C-S cambia le lettere', async () => {
    await montaConDueRoster();
    const user = userEvent.setup();
    for (let i = 1; i <= 6; i += 1) await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));

    // Nessuna lettera finche' non c'e' un palleggiatore (roster tutti schiacciatori).
    expect(screen.getByTestId('cella-a-1')).not.toHaveTextContent(/[PSCO]$/);
    await user.click(screen.getByTestId('cella-a-1'));
    const lettere = () => [1, 2, 3, 4, 5, 6].map((z) => screen.getByTestId(`ruolo-a-${z}`).textContent);
    expect(lettere()).toEqual(['P', 'S', 'C', 'O', 'S', 'C']);

    await user.click(screen.getByRole('button', { name: 'P-C-S', hidden: false }));
    expect(lettere()).toEqual(['P', 'C', 'S', 'O', 'C', 'S']);

    // Palleggiatore in zona 3: l'offset si sposta.
    await user.click(screen.getByTestId('cella-a-3'));
    expect(lettere()).toEqual(['C', 'S', 'P', 'C', 'S', 'O']);
  });
});
