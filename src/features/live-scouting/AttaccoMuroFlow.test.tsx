import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 9)];
const inCampoB = [giocatore('b1', 3)];

describe('AttaccoMuroFlow', () => {
  it('quando mostraBivio è falso parte direttamente da giocatore senza mostrare il bivio', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="A" onCompleta={onCompleta} />,
    );

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 70, clientY: 60 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'a1', valutazione: '#',
      origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
    });
  });

  it('quando mostraBivio è vero mostra prima la scelta Muro/Attacco', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByText('Muro'));
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByText('='));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 20, clientY: 60 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'muro', giocatoreId: 'b1', valutazione: '=',
      origine: { x: 60, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: false,
    });
  });

  it('un attacco toccato dal muro registra toccoMuro true e il punto di rimbalzo come destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="A" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-a1'));
    await user.click(screen.getByText('!'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('fascia-muro'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 15, clientY: 45 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'a1', valutazione: '!',
      origine: { x: 30, y: 30 }, destinazione: { x: 15, y: 45 }, toccoMuro: true,
    });
  });
});
