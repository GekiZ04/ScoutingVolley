import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RicezioneFlow } from './RicezioneFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 5)];

describe('RicezioneFlow', () => {
  it('raccoglie giocatore (tap sul campo), valutazione, origine e destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByText('!'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 40 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 50 });

    expect(onCompleta).toHaveBeenCalledWith({
      giocatoreId: 'b1',
      valutazione: '!',
      origine: { x: 55, y: 40 },
      destinazione: { x: 60, y: 50 },
    });
  });

  it('tocca solo i marker della squadra ricevente', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    expect(onCompleta).not.toHaveBeenCalled();
    expect(screen.queryByText('!')).not.toBeInTheDocument();
  });
});
