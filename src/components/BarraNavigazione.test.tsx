import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { BarraNavigazione } from './BarraNavigazione';

function montaApp(percorsoIniziale: string) {
  render(
    <MemoryRouter initialEntries={[percorsoIniziale]}>
      <Routes>
        <Route path="/" element={<div>Pagina home<Link to="/seconda">Vai alla seconda</Link></div>} />
        <Route path="/seconda" element={<div><BarraNavigazione />Pagina seconda</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BarraNavigazione', () => {
  it('Indietro torna alla pagina precedente', async () => {
    const user = userEvent.setup();
    montaApp('/');
    await user.click(screen.getByText('Vai alla seconda'));
    expect(screen.getByText('Pagina seconda')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Indietro/ }));

    expect(screen.getByText('Pagina home')).toBeInTheDocument();
  });

  it('Home porta alla home', async () => {
    const user = userEvent.setup();
    montaApp('/seconda');

    await user.click(screen.getByRole('link', { name: /Home/ }));

    expect(screen.getByText('Pagina home')).toBeInTheDocument();
  });

  it('se la pagina e stata aperta direttamente (nessuna cronologia) Indietro porta alla home', async () => {
    const user = userEvent.setup();
    montaApp('/seconda');

    await user.click(screen.getByRole('button', { name: /Indietro/ }));

    expect(screen.getByText('Pagina home')).toBeInTheDocument();
  });
});
