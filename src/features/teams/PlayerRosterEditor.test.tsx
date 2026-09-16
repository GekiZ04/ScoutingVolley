import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';
import { PlayerRosterEditor } from './PlayerRosterEditor';

describe('PlayerRosterEditor', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
  });

  it('aggiunge un giocatore al roster e lo mostra', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Numero'), '7');
    await user.type(screen.getByPlaceholderText('Nome giocatore'), 'Bianchi');
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));

    expect(await screen.findByText(/#7 Bianchi/)).toBeInTheDocument();
  });

  it('archivia un giocatore e lo rimuove dalla lista', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Numero'), '7');
    await user.type(screen.getByPlaceholderText('Nome giocatore'), 'Bianchi');
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await screen.findByText(/#7 Bianchi/);

    await user.click(screen.getByRole('button', { name: 'Archivia' }));

    expect(screen.queryByText(/#7 Bianchi/)).not.toBeInTheDocument();
  });
});
