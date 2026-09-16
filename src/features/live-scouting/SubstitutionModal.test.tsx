import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubstitutionModal } from './SubstitutionModal';

describe('SubstitutionModal', () => {
  it('conferma una sostituzione per la squadra selezionata', async () => {
    const onConferma = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal
        inCampoA={[{ id: 'a3', numero: 3, nome: 'Verdi' }]}
        inCampoB={[]}
        panchinaA={[{ id: 'libero1', numero: 15, nome: 'Neri' }]}
        panchinaB={[]}
        onConferma={onConferma}
        onChiudi={() => {}}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Esce'), 'a3');
    await user.selectOptions(screen.getByLabelText('Entra'), 'libero1');
    await user.click(screen.getByRole('button', { name: 'Conferma' }));

    expect(onConferma).toHaveBeenCalledWith({ squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1' });
  });

  it('chiama onChiudi quando si annulla', async () => {
    const onChiudi = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal inCampoA={[]} inCampoB={[]} panchinaA={[]} panchinaB={[]} onConferma={() => {}} onChiudi={onChiudi} />,
    );
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onChiudi).toHaveBeenCalled();
  });
});
