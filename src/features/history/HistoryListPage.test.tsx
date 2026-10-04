import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoPartita } from '@/db/matches';
import { HistoryListPage } from './HistoryListPage';

describe('HistoryListPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('naviga al report per una partita conclusa', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-10', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await aggiornaStatoPartita(match.id, 'conclusa');
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

  it('mostra la nota "Amichevole" per una partita della squadra contro se stessa', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraA.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
      note: 'Amichevole',
    });

    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Amichevole/)).toBeInTheDocument();
  });

  async function creaPartitaConSquadre() {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    return creaPartita({
      data: '2026-09-10', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
  }

  function montaStorico() {
    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('elimina una partita dopo la conferma', async () => {
    await creaPartitaConSquadre();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    montaStorico();

    await user.click(await screen.findByRole('button', { name: /Elimina partita/ }));

    await waitFor(() => expect(screen.queryByText(/Volley Rossi vs Volley Blu/)).not.toBeInTheDocument());
  });

  it('non elimina la partita se si annulla la conferma', async () => {
    await creaPartitaConSquadre();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    montaStorico();

    await user.click(await screen.findByRole('button', { name: /Elimina partita/ }));

    expect(screen.getByText(/Volley Rossi vs Volley Blu/)).toBeInTheDocument();
  });
});
