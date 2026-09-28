import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra } from '@/db/teams';
import { PlayerRosterEditor } from './PlayerRosterEditor';

describe('PlayerRosterEditor', () => {
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

  it('importa un roster da file CSV', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const csv = 'numero,nome,ruolo\n1,Rossi,palleggiatore\n2,Bianchi,opposto';
    const file = new File([csv], 'roster.csv', { type: 'text/csv' });
    const input = screen.getByTestId('input-importa-csv');
    await user.upload(input, file);

    expect(await screen.findByText(/#1 Rossi/)).toBeInTheDocument();
    expect(screen.getByText(/#2 Bianchi/)).toBeInTheDocument();
  });

  it('non importa nulla e mostra gli errori se il CSV ha righe non valide', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    const csv = 'numero,nome,ruolo\n1,Rossi,fantasista';
    const file = new File([csv], 'roster.csv', { type: 'text/csv' });
    const input = screen.getByTestId('input-importa-csv');
    await user.upload(input, file);

    expect(await screen.findByTestId('errori-import')).toHaveTextContent('ruolo "fantasista" non valido');
    expect(screen.queryByText(/#1 Rossi/)).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.queryByText(/#7 Bianchi/)).not.toBeInTheDocument());
  });
});
