import type { Sostituzione } from './types';

export function ruotaPosizioni(rotazione: string[]): string[] {
  return [...rotazione.slice(1), rotazione[0]];
}

export function applicaSostituzione(rotazione: string[], sostituzione: Sostituzione): string[] {
  return rotazione.map((giocatoreId) =>
    giocatoreId === sostituzione.giocatoreEsceId ? sostituzione.giocatoreEntraId : giocatoreId,
  );
}
