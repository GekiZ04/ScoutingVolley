import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrisciaCodici } from './StrisciaCodici';
import type { CodiceStriscia } from '@/domain/codiciDataVolley';

let n = 0;
function c(testo: string, squadra: CodiceStriscia['squadra'] = 'A'): CodiceStriscia {
  n += 1;
  return { chiave: `k${n}`, testo, squadra, azioneIds: [], gesto: `g${n}` };
}

describe('StrisciaCodici', () => {
  it('mostra i codici e unisce gli evidenziati al tasto Annulla', async () => {
    n = 0;
    const fn = vi.fn();
    const user = userEvent.setup();
    render(<StrisciaCodici codici={[c('a15SQ-', 'B'), c('*98RQ+')]} evidenziati={['k2']} onAnnulla={fn} disabilitato={false} />);
    expect(screen.getByText('a15SQ-')).toBeInTheDocument();
    expect(within(screen.getByTestId('codici-evidenziati')).getByText('*98RQ+')).toBeInTheDocument();
    expect(within(screen.getByTestId('codici-evidenziati')).queryByText('a15SQ-')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('colora per squadra e mette punto e fine set in nero', () => {
    n = 0;
    render(<StrisciaCodici codici={[c('*07AH#', 'A'), c('a12SQ-', 'B'), c('*p01:00', null)]} evidenziati={[]} onAnnulla={vi.fn()} disabilitato={false} />);
    expect(screen.getByText('*07AH#')).toHaveStyle({ color: '#2563eb' });
    expect(screen.getByText('a12SQ-')).toHaveStyle({ color: '#f97316' });
    expect(screen.getByText('*p01:00')).toHaveStyle({ color: '#000000' });
  });

  it('con disabilitato il tasto Annulla non si puo premere', () => {
    n = 0;
    render(<StrisciaCodici codici={[c('*07AH#')]} evidenziati={[]} onAnnulla={vi.fn()} disabilitato />);
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled();
  });

  it('mantiene l ordine cronologico: un evidenziato non in coda resta al suo posto con lo stile evidenziato', () => {
    n = 0;
    render(<StrisciaCodici codici={[c('a'), c('b'), c('c')]} evidenziati={['k1']} onAnnulla={vi.fn()} disabilitato={false} />);
    expect(screen.getAllByTestId('codice').map((el) => el.textContent)).toEqual(['a', 'b', 'c']);
    expect(screen.getByText('a')).toHaveAttribute('data-evidenziato', 'true');
    expect(screen.getByText('b')).not.toHaveAttribute('data-evidenziato');
    expect(within(screen.getByTestId('codici-evidenziati')).queryByText('a')).not.toBeInTheDocument();
  });
});
