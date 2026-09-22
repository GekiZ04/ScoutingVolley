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

// Se lo scout non segna direttamente ace (#) o errore (=) sulla battuta, ma
// registra invece la ricezione avversaria, la valutazione della battuta si
// deriva da quella della ricezione (scala invertita: ricezione forte -> battuta
// debole). '=' non compare qui perche' una ricezione '=' chiude gia' il rally
// da sola (vedi domain/reducer.ts) e non viene mai prodotta dalla derivazione
// geometrica: il caso e' gestito a parte in derivaValutazioneBattutaDaRicezione.
export const DERIVA_BATTUTA_DA_RICEZIONE: Partial<Record<Valutazione, Valutazione>> = {
  '#': '-',
  '+': '-',
  '!': '!',
  '-': '+',
  '/': '/',
};

/**
 * Valutazione della battuta derivata da quella della ricezione appaiata.
 *
 * Unica fonte di verita' per i due chiamanti: il flusso di registrazione
 * (`BattutaFlow`, dove la ricezione arriva sempre dalla derivazione geometrica,
 * quindi mai '=') e la correzione post-hoc (`liveMatchStore.correggiValutazione`,
 * dove lo scout PUO' portare la ricezione a '=').
 *
 * Caso '=': una ricezione '=' e' un ace. Il fast-path "Ace #" di `BattutaFlow`
 * registra la battuta come '#' senza nemmeno creare l'azione di ricezione, e la
 * scala invertita della tabella (ricezione peggiore -> battuta migliore) porta
 * allo stesso valore. La battuta appaiata deve quindi valere '#', non il default
 * '+': altrimenti l'ace resterebbe a referto come battuta mediocre.
 */
export function derivaValutazioneBattutaDaRicezione(valutazioneRicezione: Valutazione): Valutazione {
  if (valutazioneRicezione === '=') return '#';
  return DERIVA_BATTUTA_DA_RICEZIONE[valutazioneRicezione] ?? '+';
}
