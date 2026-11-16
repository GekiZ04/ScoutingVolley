import type { Sostituzione, Squadra } from './types';

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

/**
 * Chi occupa adesso il posto in rotazione di `giocatoreId` (di solito il
 * palleggiatore indicato nella formazione): lui stesso se e' in campo,
 * altrimenti chi e' entrato al suo posto, seguendo la catena dei cambi
 * (esce -> entra, anche con rientri). Null se nessuno di quella catena e' in
 * `rotazione`. Cosi' rotazioni P1-P6, cambio del libero e schema di ricezione
 * restano calcolabili anche dopo la sostituzione del palleggiatore.
 */
export function occupanteDelPosto(
  rotazione: string[],
  giocatoreId: string | null,
  sostituzioni: Sostituzione[],
  squadra?: Squadra,
): string | null {
  if (!giocatoreId) return null;
  const cambi = squadra ? sostituzioni.filter((s) => s.squadra === squadra) : sostituzioni;
  const visti = new Set<string>();
  const daVisitare = [giocatoreId];
  while (daVisitare.length > 0) {
    const id = daVisitare.shift()!;
    if (visti.has(id)) continue;
    visti.add(id);
    if (rotazione.includes(id)) return id;
    for (const c of cambi) if (c.giocatoreEsceId === id) daVisitare.push(c.giocatoreEntraId);
  }
  return null;
}
