import type { SetPallavolo, Squadra } from './types';

export function setNecessariPerVincere(formatoSet: 3 | 5): number {
  return Math.ceil(formatoSet / 2);
}

export function contaSetVinti(sets: SetPallavolo[]): { A: number; B: number } {
  return {
    A: sets.filter((s) => s.stato === 'concluso' && s.vincitore === 'A').length,
    B: sets.filter((s) => s.stato === 'concluso' && s.vincitore === 'B').length,
  };
}

export function squadraCheHaVintoLaPartita(
  setVintiA: number,
  setVintiB: number,
  formatoSet: 3 | 5,
): Squadra | null {
  const necessari = setNecessariPerVincere(formatoSet);
  if (setVintiA >= necessari) return 'A';
  if (setVintiB >= necessari) return 'B';
  return null;
}
