import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import type { Squadra } from '@/domain/types';
import { AnalisiIncontriPage } from './AnalisiIncontriPage';

let contatore = 0;

async function partita(opts: {
  data: string;
  rossiLato: Squadra;
  rossi: { id: string; squadraId: string };
  altra: { id: string; squadraId: string };
  battuteRossi: number;
}) {
  const { rossi, altra } = opts;
  const squadraA = opts.rossiLato === 'A' ? rossi : altra;
  const squadraB = opts.rossiLato === 'A' ? altra : rossi;
  const match = await creaPartita({
    data: opts.data, squadraAId: squadraA.squadraId, squadraBId: squadraB.squadraId,
    squadraRiferimentoId: rossi.squadraId, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: [squadraA.id, 'x2', 'x3', 'x4', 'x5', 'x6'],
    formazioneInizialeB: [squadraB.id, 'y2', 'y3', 'y4', 'y5', 'y6'],
    primaSquadraAlServizio: opts.rossiLato,
  });
  for (let i = 0; i < opts.battuteRossi; i++) {
    const rallyId = `r-${++contatore}`;
    await salvaRally({ id: rallyId, setId: set.id, numero: i + 1, squadraAlServizio: opts.rossiLato, esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: `${rallyId}-az`, rallyId, setId: set.id, ordine: 1, squadra: opts.rossiLato, giocatoreId: rossi.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '+',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
      timestamp: new Date(Date.UTC(2026, 8, 16, 10, contatore)).toISOString(),
    });
  }
  return match;
}

async function preparaDuePartite() {
  const rossi = await creaSquadra('Volley Rossi');
  const blu = await creaSquadra('Volley Blu');
  const gr = await aggiungiGiocatore({ teamId: rossi.id, numero: 1, nome: 'Alfa', ruolo: 'schiacciatore' });
  const gb = await aggiungiGiocatore({ teamId: blu.id, numero: 7, nome: 'Beta', ruolo: 'schiacciatore' });
  const r = { id: gr.id, squadraId: rossi.id };
  const b = { id: gb.id, squadraId: blu.id };
  await partita({ data: '2026-09-10', rossiLato: 'A', rossi: r, altra: b, battuteRossi: 1 });
  await partita({ data: '2026-09-17', rossiLato: 'B', rossi: r, altra: b, battuteRossi: 2 });
}

function monta() {
  render(
    <MemoryRouter initialEntries={['/analisi']}>
      <Routes>
        <Route path="/analisi" element={<AnalisiIncontriPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AnalisiIncontriPage', () => {
  it('somma le partite della squadra anche su lati diversi', async () => {
    await preparaDuePartite();
    const user = userEvent.setup();
    monta();
    await user.selectOptions(await screen.findByLabelText('Squadra'), 'Volley Rossi');
    const tabella = await screen.findByTestId('tabellino-squadra');
    expect(within(tabella).getByText('Volley Rossi')).toBeInTheDocument();
    expect(await within(tabella).findByTestId('totale-3')).toHaveTextContent('3');
    expect(within(tabella).queryByText('Set 1')).not.toBeInTheDocument();
  });

  it('togliere una partita cambia i totali', async () => {
    await preparaDuePartite();
    const user = userEvent.setup();
    monta();
    await user.selectOptions(await screen.findByLabelText('Squadra'), 'Volley Rossi');
    await within(await screen.findByTestId('tabellino-squadra')).findByTestId('totale-3');
    await user.click(await screen.findByRole('checkbox', { name: /2026-09-17/ }));
    expect(await within(screen.getByTestId('tabellino-squadra')).findByTestId('totale-3')).toHaveTextContent('1');
  });

  it('il menu partita mostra una sola partita', async () => {
    await preparaDuePartite();
    const user = userEvent.setup();
    monta();
    await user.selectOptions(await screen.findByLabelText('Squadra'), 'Volley Rossi');
    await within(await screen.findByTestId('tabellino-squadra')).findByTestId('totale-3');
    const menu = screen.getByLabelText('Vista');
    const opzione = within(menu).getByRole('option', { name: /2026-09-17/ });
    await user.selectOptions(menu, opzione);
    expect(await within(screen.getByTestId('tabellino-squadra')).findByTestId('totale-3')).toHaveTextContent('2');
  });

  it('il tasto Rotazioni apre la vista rotazione', async () => {
    await preparaDuePartite();
    const user = userEvent.setup();
    monta();
    await user.selectOptions(await screen.findByLabelText('Squadra'), 'Volley Rossi');
    await within(await screen.findByTestId('tabellino-squadra')).findByTestId('totale-3');
    await user.click(screen.getByRole('button', { name: 'Rotazioni' }));
    expect(screen.getByTestId('vista-rotazione')).toBeInTheDocument();
  });
});
