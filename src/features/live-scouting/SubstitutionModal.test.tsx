import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubstitutionModal } from './SubstitutionModal';

describe('SubstitutionModal', () => {
  it('conferma una sostituzione per la squadra del tasto premuto', async () => {
    const onConferma = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal
        squadra="A"
        inCampoA={[{ id: 'a3', teamId: 't', numero: 3, nome: 'Verdi', ruolo: 'schiacciatore', attivo: true }]}
        inCampoB={[]}
        panchinaA={[{ id: 'libero1', teamId: 't', numero: 15, nome: 'Neri', ruolo: 'libero', attivo: true }]}
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

  it('per la squadra B mostra solo i giocatori di B', async () => {
    const onConferma = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal
        squadra="B"
        inCampoA={[{ id: 'a3', teamId: 't', numero: 3, nome: 'Verdi', ruolo: 'schiacciatore', attivo: true }]}
        inCampoB={[{ id: 'b4', teamId: 'u', numero: 4, nome: 'Rosa', ruolo: 'centrale', attivo: true }]}
        panchinaA={[]}
        panchinaB={[{ id: 'b9', teamId: 'u', numero: 9, nome: 'Gialla', ruolo: 'centrale', attivo: true }]}
        onConferma={onConferma}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByText('Sostituzione squadra B')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '#3 Verdi' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Esce'), 'b4');
    await user.selectOptions(screen.getByLabelText('Entra'), 'b9');
    await user.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(onConferma).toHaveBeenCalledWith({ squadra: 'B', giocatoreEsceId: 'b4', giocatoreEntraId: 'b9' });
  });

  it('chiama onChiudi quando si annulla', async () => {
    const onChiudi = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal squadra="A" inCampoA={[]} inCampoB={[]} panchinaA={[]} panchinaB={[]} onConferma={() => {}} onChiudi={onChiudi} />,
    );
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onChiudi).toHaveBeenCalled();
  });
});
