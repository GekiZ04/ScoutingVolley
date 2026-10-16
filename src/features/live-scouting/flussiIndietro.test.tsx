import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattutaFlow } from './BattutaFlow';
import { RicezioneFlow } from './RicezioneFlow';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import type { ControlloFlusso } from './controlloFlusso';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 2)];
const tocca = (x: number, y: number) => fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: x, clientY: y });
const indietro = (ref: React.RefObject<ControlloFlusso>) => {
  let risultato = false;
  act(() => {
    risultato = ref.current!.indietro();
  });
  return risultato;
};

describe('BattutaFlow: un tocco indietro alla volta', () => {
  it('torna indietro di un tocco alla volta fino alla scelta del tipo, poi non ha piu nulla da annullare', async () => {
    const ref = createRef<ControlloFlusso>();
    const user = userEvent.setup();
    render(<BattutaFlow ref={ref} inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={vi.fn()} />);

    expect(indietro(ref)).toBe(false);
    await user.click(screen.getByText('Flottante'));
    tocca(10, 50);
    tocca(90, 20);
    expect(screen.getByText('Ace #')).toBeInTheDocument();

    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare la destinazione/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare l'origine/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(true);
    expect(screen.getByText('Salto spin')).toBeInTheDocument();
    expect(indietro(ref)).toBe(false);
  });

  it('dalla valutazione della ricezione torna alla scelta di chi riceve', async () => {
    const ref = createRef<ControlloFlusso>();
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow ref={ref} inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />);
    await user.click(screen.getByText('Flottante'));
    tocca(10, 50);
    tocca(90, 20);
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    expect(screen.getByTestId('ricezione-valutazione-+')).toBeInTheDocument();

    expect(indietro(ref)).toBe(true);
    expect(screen.getByText('Ace #')).toBeInTheDocument();
    expect(onCompleta).not.toHaveBeenCalled();
  });

  it('la squadra del ricevitore e quella del momento del tocco, anche se poi cambia', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );
    await user.click(screen.getByText('Flottante'));
    tocca(10, 50);
    tocca(90, 20);
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    rerender(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="A" onCompleta={onCompleta} />);
    await user.click(screen.getByTestId('ricezione-valutazione-+'));

    expect(onCompleta.mock.calls[0][1]).toEqual({ giocatoreId: 'b1', valutazione: '+', squadra: 'B' });
  });

  it('ripartendo da una bozza chiede solo la valutazione della ricezione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <BattutaFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        squadraRicevente="B"
        onCompleta={onCompleta}
        iniziale={{
          flusso: 'battuta', passo: 'ricezione-valutazione', tipoBattuta: 'salto_spin',
          origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 }, ricevitore: { giocatoreId: 'b1', squadra: 'B' },
        }}
      />,
    );
    await user.click(screen.getByTestId('ricezione-valutazione-!'));
    expect(onCompleta).toHaveBeenCalledWith(
      { tipoBattuta: 'salto_spin', valutazione: '!', origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 } },
      { giocatoreId: 'b1', valutazione: '!', squadra: 'B' },
    );
  });

  it('ripartendo da una bozza all esito si puo scegliere Ace o chi riceve', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <BattutaFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        squadraRicevente="B"
        onCompleta={onCompleta}
        iniziale={{ flusso: 'battuta', passo: 'esito', tipoBattuta: 'flottante', origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 } }}
      />,
    );
    await user.click(screen.getByText('Errore ='));
    expect(onCompleta).toHaveBeenCalledWith({
      tipoBattuta: 'flottante', valutazione: '=', origine: { x: 2, y: 20 }, destinazione: { x: 80, y: 70 },
    });
  });
});

describe('RicezioneFlow: un tocco indietro alla volta', () => {
  it('dalla valutazione torna alla scelta del giocatore, poi non ha piu nulla da annullare', async () => {
    const ref = createRef<ControlloFlusso>();
    const user = userEvent.setup();
    render(<RicezioneFlow ref={ref} inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={vi.fn()} />);

    expect(indietro(ref)).toBe(false);
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    expect(screen.getByTestId('ricezione-valutazione-#')).toBeInTheDocument();
    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare il giocatore/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(false);
  });

  it('ripartendo da una bozza chiede solo la valutazione, con la squadra del tocco', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        squadraRicevente="A"
        onCompleta={onCompleta}
        iniziale={{ flusso: 'ricezione', passo: 'valutazione', giocatoreId: 'b1', squadra: 'B' }}
      />,
    );
    await user.click(screen.getByTestId('ricezione-valutazione--'));
    expect(onCompleta).toHaveBeenCalledWith({ giocatoreId: 'b1', valutazione: '-', squadra: 'B' });
  });
});

describe('AttaccoMuroFlow: un tocco indietro alla volta', () => {
  it('torna indietro di un tocco alla volta fino alla scelta del giocatore', async () => {
    const ref = createRef<ControlloFlusso>();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow ref={ref} inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={vi.fn()} />);

    expect(indietro(ref)).toBe(false);
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    tocca(30, 30);
    expect(screen.getByText(/registrare la destinazione/)).toBeInTheDocument();

    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare l'origine/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare il giocatore/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(false);
  });

  it('nel ramo muro torna da "dove e finita la palla" a "chi ha murato" e poi alla destinazione', async () => {
    const ref = createRef<ControlloFlusso>();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow ref={ref} inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={vi.fn()} />);
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    tocca(30, 30);
    fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    expect(screen.getByText(/finita la palla dopo il muro/)).toBeInTheDocument();

    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/chi ha toccato a muro/)).toBeInTheDocument();
    expect(indietro(ref)).toBe(true);
    expect(screen.getByText(/registrare la destinazione/)).toBeInTheDocument();
  });

  it('ripartendo da una bozza col muro basta indicare dove e finita la palla', () => {
    const onCompleta = vi.fn();
    render(
      <AttaccoMuroFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        onCompleta={onCompleta}
        iniziale={{
          flusso: 'attacco', passo: 'muro-destinazione', giocatoreId: 'a1', squadra: 'A', origine: { x: 30, y: 30 },
          muro: { puntoTocco: { x: 52, y: 40 }, giocatoreId: 'b1' },
        }}
      />,
    );
    tocca(20, 60);
    expect(onCompleta).toHaveBeenCalledWith(
      {
        fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '+',
        origine: { x: 30, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: true,
      },
      { valutazione: '!', giocatoreId: 'b1', origine: { x: 52, y: 40 } },
    );
  });

  it('ripartendo da una bozza senza muro basta indicare la destinazione', () => {
    const onCompleta = vi.fn();
    render(
      <AttaccoMuroFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        onCompleta={onCompleta}
        iniziale={{ flusso: 'attacco', passo: 'destinazione', giocatoreId: 'a1', squadra: 'A', origine: { x: 30, y: 30 } }}
      />,
    );
    tocca(90, 80);
    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '+',
      origine: { x: 30, y: 30 }, destinazione: { x: 90, y: 80 }, toccoMuro: false,
    });
  });
});
