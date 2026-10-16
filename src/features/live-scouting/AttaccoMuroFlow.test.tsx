import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 9)];
// b0 in zona 1 (seconda linea), b1 in zona 2 (prima linea).
const inCampoB = [giocatore('b0', 1), giocatore('b1', 3)];

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

  async function finoAlMuro(onCompleta: ReturnType<typeof vi.fn>, squadraB: Player[]) {
    const user = userEvent.setup();
    render(<AttaccoMuroFlow inCampoA={inCampoA} inCampoB={squadraB} onCompleta={onCompleta} />);
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });
    return user;
  }

  it('al muro sono toccabili solo i giocatori in prima linea della squadra che mura', async () => {
    const sei = [1, 2, 3, 4, 5, 6].map((n) => giocatore(`b${n}`, n));
    await finoAlMuro(vi.fn(), sei);
    const attivo = (id: string) => screen.getByTestId(`giocatore-campo-${id}`).getAttribute('data-attivo');
    const attivi = sei.map((p) => attivo(p.id));
    expect(attivi.filter((v) => v === 'true')).toHaveLength(3);
    expect(attivi.filter((v) => v === 'false')).toHaveLength(3);
    expect(screen.getByTestId('giocatore-campo-a1')).toHaveAttribute('data-attivo', 'false');
  });

  it('Tralascia registra il muro senza giocatore', async () => {
    const onCompleta = vi.fn();
    const user = await finoAlMuro(onCompleta, inCampoB);
    await user.click(screen.getByRole('button', { name: 'Tralascia' }));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 80, clientY: 20 });
    expect(onCompleta).toHaveBeenCalledTimes(1);
    expect(onCompleta.mock.calls[0][1]).toEqual({ valutazione: '!', giocatoreId: null, origine: { x: 52, y: 40 } });
  });
});
