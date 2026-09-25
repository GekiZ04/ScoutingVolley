import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RicezioneFlow } from './RicezioneFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 5)];

describe('RicezioneFlow', () => {
  it('raccoglie giocatore (tap sul campo) e valutazione (pulsante diretto)', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByTestId('ricezione-valutazione-+'));

    expect(onCompleta).toHaveBeenCalledWith({ giocatoreId: 'b1', valutazione: '+' });
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
