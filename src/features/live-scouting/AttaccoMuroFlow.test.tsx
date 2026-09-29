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
  it('i giocatori di entrambe le squadre sono selezionabili (gli scambi non sono lineari)', () => {
    render(<AttaccoMuroFlow inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={vi.fn()} />);
    expect(screen.getByTestId('giocatore-campo-a1')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'true');
  });

  it('parte direttamente da giocatore (nessun bivio muro/attacco), poi origine e destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />);

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 70, clientY: 60 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '+',
      origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
    });
  });

  it('un tap nella zona rossa (fascia muro) chiede chi ha murato e dove e finita la palla dopo', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />);

    await user.click(screen.getByTestId('giocatore-campo-a1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });

    // Dopo il tocco muro chiede chi ha murato: solo la squadra avversaria e'
    // selezionabile, non chi ha appena attaccato.
    expect(onCompleta).not.toHaveBeenCalled();
    expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-a1')).toHaveAttribute('data-attivo', 'false');
    await user.click(screen.getByTestId('giocatore-campo-b1'));

    // ...poi dove e' finita davvero la palla dopo la deviazione: un punto
    // diverso da quello di tocco a rete.
    expect(onCompleta).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 80, clientY: 20 });

    expect(onCompleta).toHaveBeenCalledTimes(1);
    expect(onCompleta).toHaveBeenCalledWith(
      {
        fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '+',
        origine: { x: 30, y: 30 }, destinazione: { x: 80, y: 20 }, toccoMuro: true,
      },
      { valutazione: '!', giocatoreId: 'b1', origine: { x: 52, y: 40 } },
    );
  });
});
