import type { Giro } from './types';

export type RuoloSistema = 'P' | 'S' | 'C' | 'O';

const SEQUENZA: Record<Giro, RuoloSistema[]> = {
  'schiacciatore-centrale': ['P', 'S', 'C', 'O', 'S', 'C'],
  'centrale-schiacciatore': ['P', 'C', 'S', 'O', 'C', 'S'],
};

/** Ruolo (P/S/C/O) dello slot `indiceSlot` (zona-1) dati l'indice del palleggiatore e il sistema. */
export function ruoloInSlot(indiceSlot: number, indicePalleggiatore: number, giro: Giro): RuoloSistema {
  return SEQUENZA[giro][(indiceSlot - indicePalleggiatore + 6) % 6];
}
