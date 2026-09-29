import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { creaSquadra } from '@/db/teams';
import { MatchSetupPage } from './MatchSetupPage';
import type { Match } from '@/domain/types';

describe('MatchSetupPage', () => {
  it('crea una partita con le due squadre selezionate', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/partite/nuova']}>
        <Routes>
          <Route path="/partite/nuova" element={<MatchSetupPage />} />
          <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('Volley Rossi');
    await user.selectOptions(screen.getByLabelText('Squadra A'), squadraA.id);
    await user.selectOptions(screen.getByLabelText('Squadra B'), squadraB.id);
    await user.click(screen.getByRole('button', { name: 'Continua alla formazione' }));

    expect(await screen.findByText('Formazione')).toBeInTheDocument();
    const { data: partite } = await supabase.from('matches').select('*');
    expect(partite).toHaveLength(1);
    expect((partite as Match[])[0].squadraAId).toBe(squadraA.id);
  });

  it('crea una partita amichevole con la stessa squadra su entrambi i lati', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/partite/nuova']}>
        <Routes>
          <Route path="/partite/nuova" element={<MatchSetupPage />} />
          <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findAllByText('Volley Rossi');
    await user.selectOptions(screen.getByLabelText('Squadra A'), squadraA.id);
    await user.click(screen.getByLabelText('Amichevole (la squadra sfida se stessa)'));
    expect(screen.queryByLabelText('Squadra B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continua alla formazione' }));

    expect(await screen.findByText('Formazione')).toBeInTheDocument();
    const { data: partite } = await supabase.from('matches').select('*');
    expect(partite).toHaveLength(1);
    const partita = (partite as Match[])[0];
    expect(partita.squadraAId).toBe(squadraA.id);
    expect(partita.squadraBId).toBe(squadraA.id);
    expect(partita.note).toBe('Amichevole');
  });
});
