import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita } from '@/db/matches';
import { LineupPicker } from './LineupPicker';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  for (let i = 1; i <= 6; i += 1) {
    await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' });
  }
}

describe('LineupPicker', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
  });

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
    const set = (await db.sets.toArray())[0];
    expect(set.formazioneInizialeA).toEqual(
      (await db.players.where('teamId').equals(squadraA.id).sortBy('numero')).map((p) => p.id),
    );
  });
});
