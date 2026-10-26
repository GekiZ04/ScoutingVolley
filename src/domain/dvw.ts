import { RETE_X } from './courtPositions';
import type { Azione, Punto, Squadra, TipoBattuta } from './types';

// Codici scout in stile DataVolley (.dvw): squadra (* casa = A, a ospite = B),
// numero, fondamentale, tipo, valutazione, poi "~~~" (combinazione d'attacco e
// chiamata, non rilevate) e zone di partenza/arrivo ricavate dalle coordinate.

const LETTERA = { battuta: 'S', ricezione: 'R', attacco: 'A', muro: 'B' } as const;
const TIPO_BATTUTA: Record<TipoBattuta, string> = { salto_spin: 'Q', salto_flottante: 'M', flottante: 'H' };

export const prefissoSquadra = (squadra: Squadra) => (squadra === 'A' ? '*' : 'a');
export const due = (n: number) => String(n).padStart(2, '0');

// Distanza dalla rete e dalla linea laterale sinistra (in metri) per chi sta
// in quella meta' campo, guardando la rete. Null se il punto e' nell'altra meta'.
function vistaDa(punto: Punto, lato: Squadra): { daRete: number; daSinistra: number } | null {
  if (lato === 'A' ? punto.x > RETE_X : punto.x < RETE_X) return null;
  const daRete = (Math.abs(punto.x - RETE_X) / 50) * 9;
  const daSinistra = ((lato === 'A' ? punto.y : 100 - punto.y) / 100) * 9;
  return { daRete, daSinistra };
}

const colonna = (daSinistra: number) => (daSinistra < 3 ? 0 : daSinistra < 6 ? 1 : 2);

// Zone 1-9 di DataVolley: a rete 4-3-2, al centro 7-8-9, in fondo 5-6-1.
export function zonaCampo(punto: Punto, lato: Squadra): number | null {
  const v = vistaDa(punto, lato);
  if (!v) return null;
  const righe = [[4, 3, 2], [7, 8, 9], [5, 6, 1]];
  const riga = v.daRete < 3 ? 0 : v.daRete < 6 ? 1 : 2;
  return righe[riga][colonna(v.daSinistra)];
}

// Zone di partenza della battuta lungo la linea di fondo: 5-7-6-9-1.
export function zonaBattuta(punto: Punto, lato: Squadra): number | null {
  const v = vistaDa(punto, lato);
  if (!v) return null;
  return [5, 7, 6, 9, 1][Math.min(4, Math.floor(v.daSinistra / 1.8))];
}

const altra = (s: Squadra): Squadra => (s === 'A' ? 'B' : 'A');

/**
 * Codice di un'azione. `battuta` e' la battuta del rally: la ricezione ne
 * prende tipo e zone, come in DataVolley.
 */
export function codiceScout(azione: Azione, numero: number | null, battuta: Azione | null): string {
  const tipo =
    azione.fondamentale === 'battuta'
      ? TIPO_BATTUTA[azione.tipoBattuta ?? 'flottante']
      : azione.fondamentale === 'ricezione' && battuta?.tipoBattuta
        ? TIPO_BATTUTA[battuta.tipoBattuta]
        : 'H';
  const base = `${prefissoSquadra(azione.squadra)}${numero === null ? '$$' : due(numero)}${LETTERA[azione.fondamentale]}${tipo}${azione.valutazione}`;

  let partenza: number | null = null;
  let arrivo: number | null = null;
  const daBattuta = azione.fondamentale === 'battuta' ? azione : azione.fondamentale === 'ricezione' ? battuta : null;
  if (daBattuta?.origine && daBattuta.destinazione) {
    partenza = zonaBattuta(daBattuta.origine, daBattuta.squadra);
    arrivo = zonaCampo(daBattuta.destinazione, altra(daBattuta.squadra));
  } else if (azione.fondamentale === 'attacco' && azione.origine && azione.destinazione) {
    partenza = zonaCampo(azione.origine, azione.squadra);
    arrivo = zonaCampo(azione.destinazione, altra(azione.squadra));
  }
  if (partenza === null && arrivo === null) return base;
  return `${base}~~~${partenza ?? '~'}${arrivo ?? '~'}`;
}
