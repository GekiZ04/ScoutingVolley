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
const giocatoriBSei: Player[] = [1, 2, 3, 4, 5, 6].map((n) => (
  { id: `b${n}`, teamId: 'tB', numero: n, nome: `B${n}`, ruolo: 'schiacciatore', attivo: true }
));

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
    fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });
    expect(onSelezionaMuro).toHaveBeenCalledWith({ x: 52, y: 40 });
    expect(onSelezionaPunto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 10 });
    expect(onSelezionaPunto).toHaveBeenCalledWith({ x: 10, y: 10 });
  });

  it('segna i marker attivi con data-attivo per distinguerli da quelli non cliccabili', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'seleziona-giocatore', squadraAttiva: 'B', onSeleziona: vi.fn() }}
      />,
    );
    expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-a1')).toHaveAttribute('data-attivo', 'false');
  });

  it('in modalita seleziona-giocatore-prima-linea attiva solo le zone 2,3,4 della squadra indicata', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriBSei}
        modalita={{ tipo: 'seleziona-giocatore-prima-linea', squadraAttiva: 'B', onSeleziona: vi.fn() }}
      />,
    );
    // b2,b3,b4 sono in zona 2,3,4 (prima linea); b1,b5,b6 sono in zona 1,5,6 (fondo campo).
    expect(screen.getByTestId('giocatore-campo-b2')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-b3')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-b4')).toHaveAttribute('data-attivo', 'true');
    expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'false');
    expect(screen.getByTestId('giocatore-campo-b5')).toHaveAttribute('data-attivo', 'false');
    expect(screen.getByTestId('giocatore-campo-b6')).toHaveAttribute('data-attivo', 'false');
    expect(screen.getByTestId('giocatore-campo-a1')).toHaveAttribute('data-attivo', 'false');
  });

  it('disegna la traiettoria dellultima azione quando fornita, colorata di verde se il rally continua', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'inattivo' }}
        ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'continua' }}
      />,
    );
    const traiettoria = screen.getByTestId('ultima-traiettoria');
    expect(traiettoria.querySelector('line')).toHaveAttribute('x1', '10');
    expect(traiettoria.querySelector('line')).toHaveAttribute('y1', '10');
    expect(traiettoria.querySelector('line')).toHaveAttribute('y2', '30');
    expect(traiettoria.querySelector('line')).toHaveAttribute('stroke', '#22c55e');
  });

  it('colora la traiettoria di nero quando lazione fa punto per chi lha eseguita', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'inattivo' }}
        ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'punto_esecutore' }}
      />,
    );
    expect(screen.getByTestId('ultima-traiettoria').querySelector('line')).toHaveAttribute('stroke', '#000000');
  });

  it('colora la traiettoria di rosso quando lazione fa punto per la squadra avversaria', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'inattivo' }}
        ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'punto_avversario' }}
      />,
    );
    expect(screen.getByTestId('ultima-traiettoria').querySelector('line')).toHaveAttribute('stroke', '#ef4444');
  });

  it('disegna la traiettoria in corso quando origine e destinazione sono gia stati scelti ma lazione non e ancora completata', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'inattivo' }}
        origineSelezionata={{ x: 10, y: 20 }}
        destinazioneSelezionata={{ x: 80, y: 60 }}
      />,
    );
    expect(screen.getByTestId('traiettoria-in-corso')).toHaveAttribute('x1', '10');
    expect(screen.getByTestId('traiettoria-in-corso')).toHaveAttribute('y2', '30');
  });

  it('non disegna la traiettoria in corso se manca la destinazione', () => {
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'inattivo' }}
        origineSelezionata={{ x: 10, y: 20 }}
      />,
    );
    expect(screen.queryByTestId('traiettoria-in-corso')).not.toBeInTheDocument();
  });

  it('non disegna alcuna traiettoria se non fornita', () => {
    render(<CampoDaGioco inCampoA={giocatoriA} inCampoB={giocatoriB} modalita={{ tipo: 'inattivo' }} />);
    expect(screen.queryByTestId('ultima-traiettoria')).not.toBeInTheDocument();
  });
});
