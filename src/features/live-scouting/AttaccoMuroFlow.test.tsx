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
const inCampoBSei = [1, 2, 3, 4, 5, 6].map((n) => giocatore(`b${n}`, n));

describe('AttaccoMuroFlow', () => {
  it('quando mostraBivio è falso parte direttamente da giocatore, poi traiettoria, poi valutazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="A" onCompleta={onCompleta} />,
    );

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 70, clientY: 60 });
    await user.click(screen.getByText('#'));

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
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 20, clientY: 60 });
    await user.click(screen.getByText('='));

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'muro', giocatoreId: 'b1', valutazione: '=',
      origine: { x: 60, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: false,
    });
  });

  it('un attacco toccato dal muro fa valutare anche il tocco e il giocatore di prima linea che lo ha fatto', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow
        mostraBivio={false}
        inCampoA={inCampoA}
        inCampoB={inCampoBSei}
        squadraProtagonista="A"
        onCompleta={onCompleta}
      />,
    );

    await user.click(screen.getByTestId('giocatore-campo-a1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 15, clientY: 45 });

    // Solo i giocatori di prima linea (zone 2,3,4 → b2,b3,b4) della squadra a
    // muro devono essere selezionabili; b1 (zona 1, fondo campo) resta inattivo.
    expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'false');
    expect(screen.getByTestId('giocatore-campo-b3')).toHaveAttribute('data-attivo', 'true');
    await user.click(screen.getByTestId('giocatore-campo-b3'));
    await user.click(screen.getByText('+'));
    await user.click(screen.getByText('!'));

    expect(onCompleta).toHaveBeenCalledWith(
      {
        fondamentale: 'attacco', giocatoreId: 'a1', valutazione: '!',
        origine: { x: 30, y: 30 }, destinazione: { x: 15, y: 45 }, toccoMuro: true,
      },
      { giocatoreId: 'b3', valutazione: '+', origine: { x: 52, y: 40 } },
    );
  });
});
