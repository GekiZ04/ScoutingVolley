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
  it('raccoglie giocatore (tap sul campo), origine e valutazione: solo qualita, nessuna traiettoria', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-b1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 40 });
    await user.click(screen.getByText('!'));

    expect(onCompleta).toHaveBeenCalledWith({
      giocatoreId: 'b1',
      valutazione: '!',
      origine: { x: 55, y: 40 },
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
    expect(screen.getByText(/il giocatore/)).toBeInTheDocument();
  });
});
