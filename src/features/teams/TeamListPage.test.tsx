import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db/schema';
import { TeamListPage } from './TeamListPage';

describe('TeamListPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
  });

  it('crea una squadra e la mostra nella lista', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamListPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Nome squadra'), 'Volley Rossi');
    await user.click(screen.getByRole('button', { name: 'Crea squadra' }));

    expect(await screen.findByText('Volley Rossi')).toBeInTheDocument();
  });
});
