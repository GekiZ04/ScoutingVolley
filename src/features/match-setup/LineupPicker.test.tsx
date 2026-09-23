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
    for (let i = 4; i <= 7; i += 1) {
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

    await user.click(screen.getByText('#1 Lib1'));
    await user.click(screen.getByText('#2 Lib2'));
    for (let i = 4; i <= 7; i += 1) {
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
});
