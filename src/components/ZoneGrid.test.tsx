import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneGrid } from './ZoneGrid';

describe('ZoneGrid', () => {
  it('mostra 6 celle per la variante origine con la disposizione standard 4-3-2/5-6-1', () => {
    render(<ZoneGrid variante="origine" onSeleziona={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('mostra 9 celle per la variante destinazione e invoca onSeleziona con la zona corretta', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(<ZoneGrid variante="destinazione" onSeleziona={onSeleziona} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    await user.click(screen.getByText('6'));
    expect(onSeleziona).toHaveBeenCalledWith(6);
  });
});
