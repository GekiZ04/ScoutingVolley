import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RicezioneFlow } from './RicezioneFlow';

describe('RicezioneFlow', () => {
  it('raccoglie giocatore, valutazione e zona e chiama onCompleta', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow
        giocatoriInCampo={[{ id: 'p1', numero: 5, nome: 'Bianchi' }]}
        onCompleta={onCompleta}
      />,
    );

    await user.click(screen.getByText('#5 Bianchi'));
    await user.click(screen.getByText('!'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);

    expect(onCompleta).toHaveBeenCalledWith({ giocatoreId: 'p1', valutazione: '!', zona: 4 });
  });
});
