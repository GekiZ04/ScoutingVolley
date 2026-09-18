import type { Player, Punto, Squadra } from './types';

// Geometria standard FIVB: fila a rete 4-3-2 (sinistra-centro-destra), fila di
// fondo 5-6-1. x=40 e' vicino alla rete, x=10 e' vicino al fondo campo (per la
// squadra A; la squadra B e' il riflesso puntuale rispetto al centro campo).
const POSIZIONI_A: Record<1 | 2 | 3 | 4 | 5 | 6, Punto> = {
  4: { x: 40, y: 10 },
  3: { x: 40, y: 50 },
  2: { x: 40, y: 90 },
  5: { x: 10, y: 10 },
  6: { x: 10, y: 50 },
  1: { x: 10, y: 90 },
};

export const ZONE_PRIMA_LINEA = [2, 3, 4] as const;

export type MarkerCampo = {
  giocatoreId: string;
  numero: number;
  zona: 1 | 2 | 3 | 4 | 5 | 6;
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
      zona,
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
