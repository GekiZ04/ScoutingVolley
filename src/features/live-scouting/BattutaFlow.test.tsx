import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattutaFlow } from './BattutaFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 2)];

describe('BattutaFlow', () => {
  it('il campo resta montato durante tutto il flusso e raccoglie tipo, valutazione, origine e destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />);

    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    await user.click(screen.getByText('Salto flottante'));
    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    await user.click(screen.getByText('#'));
    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 20 });

    expect(onCompleta).toHaveBeenCalledWith({
      tipoBattuta: 'salto_flottante',
      valutazione: '#',
      origine: { x: 10, y: 50 },
      destinazione: { x: 90, y: 20 },
    });
  });
});
