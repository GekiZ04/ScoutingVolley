import { describe, it, expect } from 'vitest';
import { contaSetVinti, setNecessariPerVincere, squadraCheHaVintoLaPartita } from './matchProgress';
import type { SetPallavolo } from './types';

function set(numero: number, stato: SetPallavolo['stato'], vincitore: SetPallavolo['vincitore']): SetPallavolo {
  return {
    id: `s${numero}`, matchId: 'm', numero,
    formazioneInizialeA: [], formazioneInizialeB: [], primaSquadraAlServizio: 'A',
    stato, vincitore,
  };
}

describe('setNecessariPerVincere', () => {
  it('al meglio dei 3 servono 2 set', () => {
    expect(setNecessariPerVincere(3)).toBe(2);
  });

  it('al meglio dei 5 servono 3 set', () => {
    expect(setNecessariPerVincere(5)).toBe(3);
  });
});

describe('contaSetVinti', () => {
  it('conta solo i set conclusi, ignorando quello in corso', () => {
    const sets = [set(1, 'concluso', 'A'), set(2, 'concluso', 'B'), set(3, 'in_corso', null)];
    expect(contaSetVinti(sets)).toEqual({ A: 1, B: 1 });
  });
});

describe('squadraCheHaVintoLaPartita', () => {
  it('nessuno ha ancora vinto se nessuna squadra raggiunge i set necessari', () => {
    expect(squadraCheHaVintoLaPartita(1, 0, 3)).toBeNull();
  });

  it('la squadra A vince al meglio dei 3 con 2 set vinti', () => {
    expect(squadraCheHaVintoLaPartita(2, 0, 3)).toBe('A');
  });

  it('la squadra B vince al meglio dei 5 con 3 set vinti', () => {
    expect(squadraCheHaVintoLaPartita(2, 3, 5)).toBe('B');
  });
});
