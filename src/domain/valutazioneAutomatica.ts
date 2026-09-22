import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B } from './courtPositions';
import type { Punto, Squadra, Valutazione } from './types';

function zonaIdealeRicezione(squadra: Squadra): Punto {
  return squadra === 'A' ? { x: LINEA_TRE_METRI_A, y: 50 } : { x: LINEA_TRE_METRI_B, y: 50 };
}

export function derivaValutazioneRicezione(squadra: Squadra, destinazione: Punto): Valutazione {
  const ideale = zonaIdealeRicezione(squadra);
  const distanza = Math.hypot(destinazione.x - ideale.x, destinazione.y - ideale.y);
  if (distanza <= 8) return '#';
  if (distanza <= 16) return '+';
  if (distanza <= 26) return '!';
  if (distanza <= 40) return '-';
  return '/';
}

export function derivaValutazioneMuro(squadraBloccante: Squadra, rimbalzo: Punto): Valutazione | null {
  const profondita = squadraBloccante === 'A' ? rimbalzo.x - 50 : 50 - rimbalzo.x;
  if (profondita >= 30) return '#';
  if (profondita >= 15) return '+';
  if (profondita >= 0) return '!';
  return null;
}

export function derivaValutazioneAttaccoCerta(
  toccoMuro: boolean,
  valutazioneMuro: Valutazione | null,
): Valutazione | null {
  if (toccoMuro && valutazioneMuro === '#') return '/';
  return null;
}
