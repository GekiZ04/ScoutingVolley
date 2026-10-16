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

async function fissaTipoOrigineDestinazione(user: ReturnType<typeof userEvent.setup>, tipo = 'Salto flottante') {
  await user.click(screen.getByText(tipo));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 20 });
}

describe('BattutaFlow', () => {
  it('un ace si registra con un tap diretto, senza passare dalla ricezione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />);

    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    await fissaTipoOrigineDestinazione(user);
    await user.click(screen.getByText('Ace #'));

    expect(onCompleta).toHaveBeenCalledWith(
      { tipoBattuta: 'salto_flottante', valutazione: '#', origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 } },
    );
  });

  it('un errore di battuta si registra con un tap diretto', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />);

    await fissaTipoOrigineDestinazione(user, 'Flottante');
    await user.click(screen.getByText('Errore ='));

    expect(onCompleta).toHaveBeenCalledWith(
      { tipoBattuta: 'flottante', valutazione: '=', origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 } },
    );
  });

  it('toccando chi riceve si registra anche la ricezione, e la battuta prende una valutazione derivata', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />);

    await fissaTipoOrigineDestinazione(user);
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByTestId('ricezione-valutazione-+'));

    expect(onCompleta).toHaveBeenCalledWith(
      {
        tipoBattuta: 'salto_flottante', valutazione: '-',
        origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 },
      },
      { giocatoreId: 'b1', valutazione: '+', squadra: 'B' },
    );
  });

  it('mostra lo storico finche non si tocca la partenza', async () => {
    const user = userEvent.setup();
    const t = (x: number) => ({ origine: { x, y: 50 }, destinazione: { x: 80, y: 30 }, esito: 'punto_esecutore' as const });
    render(
      <BattutaFlow
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        squadraRicevente="B"
        storicoBattute={[t(5), t(10), t(15)]}
        onCompleta={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('traiettoria-extra')).toHaveLength(3);
    await user.click(screen.getByText('Flottante'));
    expect(screen.getAllByTestId('traiettoria-extra')).toHaveLength(3);
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    expect(screen.queryAllByTestId('traiettoria-extra')).toHaveLength(0);
  });
});
