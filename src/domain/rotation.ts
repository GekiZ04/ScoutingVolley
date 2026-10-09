import type { Sostituzione } from './types';

export function ruotaPosizioni(rotazione: string[]): string[] {
  return [...rotazione.slice(1), rotazione[0]];
}

// Sposta tutti i giocatori di `passi` posizioni, tenendoli insieme: +1 e' una
// rotazione normale (chi era in P5 passa in P4), -1 la riporta indietro.
export function ruotaFormazione(formazione: string[], passi: number): string[] {
  const n = formazione.length;
  if (n === 0) return [];
  const spostamento = ((passi % n) + n) % n;
  return [...formazione.slice(spostamento), ...formazione.slice(0, spostamento)];
}

export function applicaSostituzione(rotazione: string[], sostituzione: Sostituzione): string[] {
  return rotazione.map((giocatoreId) =>
    giocatoreId === sostituzione.giocatoreEsceId ? sostituzione.giocatoreEntraId : giocatoreId,
  );
}
