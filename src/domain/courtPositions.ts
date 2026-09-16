import type { Player, Punto, Squadra } from './types';

const POSIZIONI_A: Record<1 | 2 | 3 | 4 | 5 | 6, Punto> = {
  1: { x: 10, y: 10 },
  2: { x: 10, y: 50 },
  3: { x: 10, y: 90 },
  4: { x: 40, y: 10 },
  5: { x: 40, y: 50 },
  6: { x: 40, y: 90 },
};

export type MarkerCampo = {
  giocatoreId: string;
  numero: number;
  x: number;
  y: number;
};

export function posizioneZona(squadra: Squadra, zona: 1 | 2 | 3 | 4 | 5 | 6): Punto {
  const a = POSIZIONI_A[zona];

  if (squadra === 'A') {
    return a;
  }

  return { x: 100 - a.x, y: 100 - a.y };
}

export function costruisciMarker(giocatoriInCampo: Player[], squadra: Squadra): MarkerCampo[] {
  return giocatoriInCampo.map((giocatore, indice) => {
    const zona = (indice + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const posizione = posizioneZona(squadra, zona);

    return {
      giocatoreId: giocatore.id,
      numero: giocatore.numero,
      x: posizione.x,
      y: posizione.y,
    };
  });
}

export function fasciaMuro(squadraAttaccante: Squadra): { xMin: number; xMax: number } {
  return squadraAttaccante === 'A'
    ? { xMin: 50, xMax: 55 }
    : { xMin: 45, xMax: 50 };
}
