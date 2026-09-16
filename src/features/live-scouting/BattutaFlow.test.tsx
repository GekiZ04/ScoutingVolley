import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattutaFlow } from './BattutaFlow';

describe('BattutaFlow', () => {
  it('raccoglie tipo, valutazione, zona e direzione e chiama onCompleta con i dati completi', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow onCompleta={onCompleta} />);

    await user.click(screen.getByText('Salto flottante'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      tipoBattuta: 'salto_flottante',
      valutazione: '#',
      zona: 4,
      direzione: 7,
    });
  });
});
