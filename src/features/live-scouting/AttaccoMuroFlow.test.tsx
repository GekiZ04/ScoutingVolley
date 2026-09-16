import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';

const giocatori = [{ id: 'p1', numero: 9, nome: 'Neri' }];

describe('AttaccoMuroFlow', () => {
  it('quando mostraBivio è falso parte direttamente da attacco senza mostrare il bivio', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow mostraBivio={false} giocatoriInCampo={giocatori} onCompleta={onCompleta} />);

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByText('#9 Neri'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'p1', valutazione: '#', zona: 4, direzione: 7,
    });
  });

  it('quando mostraBivio è vero mostra prima la scelta Muro/Attacco', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow mostraBivio giocatoriInCampo={giocatori} onCompleta={onCompleta} />);

    await user.click(screen.getByText('Muro'));
    await user.click(screen.getByText('#9 Neri'));
    await user.click(screen.getByText('='));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'muro', giocatoreId: 'p1', valutazione: '=', zona: 4, direzione: 7,
    });
  });
});
