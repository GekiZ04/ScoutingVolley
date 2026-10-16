import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoPartita, aggiornaStatoSet } from '@/db/matches';
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
          <Route path="/storico/:matchId" element={<div>Scheda partita</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText('Volley Rossi'));
    expect(await screen.findByText('Scheda partita')).toBeInTheDocument();
  });

  it('una partita in corso si apre comunque sulla scheda', async () => {
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
          <Route path="/storico/:matchId" element={<div>Scheda partita</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText('Volley Rossi'));
    expect(await screen.findByText('Scheda partita')).toBeInTheDocument();
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

  it('archivio mostra i set vinti', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-10', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const vincitori = ['A', 'A', 'B', 'A'] as const;
    for (let i = 0; i < vincitori.length; i++) {
      const set = await creaSet({
        matchId: match.id, numero: i + 1,
        formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
        formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
        primaSquadraAlServizio: 'A',
      });
      await aggiornaStatoSet(set.id, 'concluso', vincitori[i]);
    }
    montaStorico();

    expect(await screen.findByText('3 - 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nuova partita/ })).toBeInTheDocument();
    expect(screen.getByText('Volley Rossi')).toBeInTheDocument();
    expect(screen.getByText('Volley Blu')).toBeInTheDocument();
  });

  function montaStorico() {
    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
          <Route path="/partite/nuova" element={<div>Nuova</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }
});
