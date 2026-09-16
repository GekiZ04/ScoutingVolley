import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoDaGioco } from './CampoDaGioco';
import type { Player } from '@/domain/types';

const giocatoriA: Player[] = [
  { id: 'a1', teamId: 'tA', numero: 1, nome: 'A1', ruolo: 'palleggiatore', attivo: true },
];
const giocatoriB: Player[] = [
  { id: 'b1', teamId: 'tB', numero: 9, nome: 'B1', ruolo: 'centrale', attivo: true },
];

describe('CampoDaGioco', () => {
  it('mostra sempre i marker di entrambe le squadre', () => {
    render(<CampoDaGioco inCampoA={giocatoriA} inCampoB={giocatoriB} modalita={{ tipo: 'inattivo' }} />);
    expect(screen.getByTestId('giocatore-campo-a1')).toBeInTheDocument();
    expect(screen.getByTestId('giocatore-campo-b1')).toBeInTheDocument();
  });

  it('in modalita seleziona-giocatore chiama onSeleziona solo per i marker della squadra attiva', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'seleziona-giocatore', squadraAttiva: 'B', onSeleziona }}
      />,
    );
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    expect(onSeleziona).toHaveBeenCalledWith('b1');

    onSeleziona.mockClear();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    expect(onSeleziona).not.toHaveBeenCalled();
  });

  it('in modalita seleziona-punto restituisce le coordinate percentuali del click', () => {
    const onSeleziona = vi.fn();
    render(
      <CampoDaGioco inCampoA={giocatoriA} inCampoB={giocatoriB} modalita={{ tipo: 'seleziona-punto', onSeleziona }} />,
    );
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 70 });
    expect(onSeleziona).toHaveBeenCalledWith({ x: 30, y: 70 });
  });

  it('in modalita seleziona-punto-con-fascia-muro un click sulla fascia chiama onSelezionaMuro invece di onSelezionaPunto', () => {
    const onSelezionaPunto = vi.fn();
    const onSelezionaMuro = vi.fn();
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'seleziona-punto-con-fascia-muro', squadraAttaccante: 'A', onSelezionaPunto, onSelezionaMuro }}
      />,
    );
    fireEvent.click(screen.getByTestId('fascia-muro'));
    expect(onSelezionaMuro).toHaveBeenCalled();
    expect(onSelezionaPunto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 10 });
    expect(onSelezionaPunto).toHaveBeenCalledWith({ x: 10, y: 10 });
  });
});
