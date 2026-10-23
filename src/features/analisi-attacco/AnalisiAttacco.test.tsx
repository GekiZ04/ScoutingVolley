import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { scaricaPdf } from '@/features/export/exportPdf';
import { AnalisiAttacco } from './AnalisiAttacco';

vi.mock('@/features/export/exportPdf', () => ({ scaricaPdf: vi.fn() }));
import type { Azione, Player } from '@/domain/types';

let n = 0;
function attacco(extra: Partial<Azione>): Azione {
  n += 1;
  return {
    id: `att${n}`, rallyId: `r${n}`, setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'a4',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '+',
    origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 10 }, toccoMuro: false,
    timestamp: '2026-10-23T10:00:00.000Z', ...extra,
  };
}

const giocatori: Player[] = [
  { id: 'a4', teamId: 'tA', numero: 4, nome: 'Rossi', ruolo: 'schiacciatore', attivo: true },
  { id: 'a2', teamId: 'tA', numero: 2, nome: 'Bianchi', ruolo: 'opposto', attivo: true },
  { id: 'a9', teamId: 'tA', numero: 9, nome: 'Senza attacchi', ruolo: 'centrale', attivo: true },
  { id: 'b7', teamId: 'tB', numero: 7, nome: 'Verdi', ruolo: 'schiacciatore', attivo: true },
];

const azioni: Azione[] = [
  attacco({ valutazione: '#' }),
  attacco({ valutazione: '+' }),
  attacco({ giocatoreId: 'a2', origine: { x: 40, y: 90 }, destinazione: { x: 90, y: 90 }, valutazione: '=' }),
  attacco({ squadra: 'B', giocatoreId: 'b7', origine: { x: 60, y: 90 }, destinazione: { x: 10, y: 50 }, setId: 's2' }),
  attacco({ origine: null }),
];

function apri(onChiudi = vi.fn()) {
  render(
    <AnalisiAttacco
      azioni={azioni}
      giocatori={giocatori}
      nomiSquadre={{ A: 'Volley Rossi', B: 'Volley Blu' }}
      sets={[{ id: 's1', numero: 1 }, { id: 's2', numero: 2 }]}
      onChiudi={onChiudi}
    />,
  );
  return { user: userEvent.setup(), onChiudi };
}

describe('AnalisiAttacco', () => {
  it('parte dalla squadra A con il riepilogo degli attacchi che hanno partenza e arrivo', () => {
    apri();
    expect(screen.getByTestId('riepilogo-attacchi')).toHaveTextContent('3 attacchi');
    expect(screen.getByTestId('riepilogo-attacchi')).toHaveTextContent('Kill 33%');
    expect(screen.getByTestId('mappa-calore')).toBeInTheDocument();
  });

  it('cambiando squadra cambiano attacchi e giocatori proposti', async () => {
    const { user } = apri();
    const giocatore = screen.getByLabelText('Giocatore');
    expect(within(giocatore).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Tutti', '#2 Bianchi (1)', '#4 Rossi (2)',
    ]);
    await user.selectOptions(screen.getByLabelText('Squadra'), 'B');
    expect(screen.getByTestId('riepilogo-attacchi')).toHaveTextContent('1 attacchi');
    expect(within(screen.getByLabelText('Giocatore')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Tutti', '#7 Verdi (1)',
    ]);
  });

  it('filtra per giocatore, zona di partenza e set', async () => {
    const { user } = apri();
    await user.selectOptions(screen.getByLabelText('Giocatore'), 'a4');
    expect(screen.getByTestId('riepilogo-attacchi')).toHaveTextContent('2 attacchi');
    await user.selectOptions(screen.getByLabelText('Giocatore'), '');
    await user.selectOptions(screen.getByLabelText('Zona di partenza'), '2');
    expect(screen.getByTestId('riepilogo-attacchi')).toHaveTextContent('1 attacchi');
    await user.selectOptions(screen.getByLabelText('Zona di partenza'), '');
    await user.selectOptions(screen.getByLabelText('Set'), 's2');
    expect(screen.getByText(/Nessun attacco/)).toBeInTheDocument();
  });

  it('griglia da 1 m: percentuale degli arrivi in ogni quadrato', async () => {
    const { user } = apri();
    await user.click(screen.getByRole('button', { name: 'Griglia 1 m' }));
    // Due arrivi su tre a 0,9 m dalla sinistra e 1,8 m dal fondo.
    expect(screen.getByTestId('cella-1-0')).toHaveTextContent('67%');
    expect(screen.getByTestId('cella-1-8')).toHaveTextContent('33%');
  });

  it('angoli: ventaglio con percentuale e numero di attacchi per settore', async () => {
    const { user } = apri();
    await user.click(screen.getByRole('button', { name: 'Angoli' }));
    expect(screen.getByTestId('settore-0')).toHaveTextContent('100%');
    expect(screen.getByTestId('settore-0')).toHaveTextContent('N=3');
  });

  it('kill % per angolo: cambio palla e transizione affiancati', async () => {
    const { user } = apri();
    await user.click(screen.getByRole('button', { name: 'Kill % per angolo' }));
    expect(screen.getByText('Cambio palla')).toBeInTheDocument();
    expect(screen.getByText('Transizione')).toBeInTheDocument();
    expect(screen.getAllByTestId('campo-analisi')).toHaveLength(2);
  });

  it('traiettorie: una linea per attacco e legenda con i conteggi per esito', async () => {
    const { user } = apri();
    await user.click(screen.getByRole('button', { name: 'Traiettorie' }));
    expect(screen.getAllByTestId(/^traiettoria-/)).toHaveLength(3);
    const legenda = screen.getByTestId('legenda-esiti');
    expect(legenda).toHaveTextContent('Punto (#) 1');
    expect(legenda).toHaveTextContent('Difeso 1');
    expect(legenda).toHaveTextContent('Errore (= /) 1');
  });

  it('Chiudi chiude il pannello', async () => {
    const { user, onChiudi } = apri();
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onChiudi).toHaveBeenCalled();
  });

  it('Esporta PDF scarica le mappe con i filtri scelti', async () => {
    const { user } = apri();
    await user.selectOptions(screen.getByLabelText('Giocatore'), 'a4');
    await user.click(screen.getByRole('button', { name: 'Esporta PDF' }));
    expect(scaricaPdf).toHaveBeenCalledTimes(1);
    const [nome, blob] = vi.mocked(scaricaPdf).mock.calls[0];
    expect(nome).toBe('mappe-attacco-Volley-Rossi.pdf');
    expect((blob as Blob).type).toBe('application/pdf');
  });
});
