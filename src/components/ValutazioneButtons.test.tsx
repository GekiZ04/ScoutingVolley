import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValutazioneButtons } from './ValutazioneButtons';

describe('ValutazioneButtons', () => {
  it('mostra le 6 valutazioni standard e invoca onSeleziona con quella scelta', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(<ValutazioneButtons onSeleziona={onSeleziona} />);
    expect(screen.getAllByRole('button')).toHaveLength(6);
    await user.click(screen.getByText('#'));
    expect(onSeleziona).toHaveBeenCalledWith('#');
  });
});
