import { describe, it, expect } from 'vitest';
import { giocatoreEleggibileLibero, servonoLiberiSelezionati } from './liberi';
import type { Player } from './types';

const giocatore = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1', teamId: 't1', numero: 1, nome: 'Rossi', ruolo: 'libero', attivo: true, ...overrides,
});

describe('giocatoreEleggibileLibero', () => {
  it('un giocatore non libero e sempre eleggibile', () => {
    expect(giocatoreEleggibileLibero(giocatore({ ruolo: 'schiacciatore' }), ['altro'])).toBe(true);
  });

  it('un libero e eleggibile se liberiSelezionati e null (nessun vincolo)', () => {
    expect(giocatoreEleggibileLibero(giocatore(), null)).toBe(true);
  });

  it('un libero e eleggibile solo se presente in liberiSelezionati', () => {
    expect(giocatoreEleggibileLibero(giocatore({ id: 'p1' }), ['p1', 'p2'])).toBe(true);
    expect(giocatoreEleggibileLibero(giocatore({ id: 'p3' }), ['p1', 'p2'])).toBe(false);
  });
});

describe('servonoLiberiSelezionati', () => {
  it('falso con 2 o meno liberi in rosa', () => {
    const giocatori = [giocatore({ id: 'p1' }), giocatore({ id: 'p2' }), giocatore({ id: 'p3', ruolo: 'centrale' })];
    expect(servonoLiberiSelezionati(giocatori)).toBe(false);
  });

  it('vero con piu di 2 liberi in rosa', () => {
    const giocatori = [giocatore({ id: 'p1' }), giocatore({ id: 'p2' }), giocatore({ id: 'p3' })];
    expect(servonoLiberiSelezionati(giocatori)).toBe(true);
  });
});
