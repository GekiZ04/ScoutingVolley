import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { HistoryListPage } from './HistoryListPage';

describe('HistoryListPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.matches.clear();
    await db.sets.clear();
  });

  it('naviga al report per una partita conclusa', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-10', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await db.matches.update(match.id, { stato: 'conclusa' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
          <Route path="/storico/:matchId" element={<div>Report partita</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText(/Volley Rossi vs Volley Blu/));
    expect(await screen.findByText('Report partita')).toBeInTheDocument();
  });

  it('riprende una partita in corso allultimo set aperto', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting ripreso</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText(/Volley Rossi vs Volley Blu/));
    expect(await screen.findByText('Scouting ripreso')).toBeInTheDocument();
  });
});
