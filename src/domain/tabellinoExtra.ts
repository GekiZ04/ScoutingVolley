import type { InfoRally } from './cronologiaSet';
import { determinaEsitoAutomatico, perdePunto, raggruppaPerRally, rallyUnici, vincePunto } from './reducer';
import type { Azione, Player, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

export interface StatPunti {
  tot: number;
  bp: number;
  vp: number;
}

/** Punti (tot), break point (bp) e punti vinti meno persi (vp) delle azioni del filtro. */
export function statPunti(azioni: Azione[], rallies: Rally[], filtro: (a: Azione) => boolean): StatPunti {
  const servizioPerRally = new Map(rallies.map((r) => [r.id, r.squadraAlServizio]));
  let tot = 0;
  let bp = 0;
  let persi = 0;
  for (const a of azioni) {
    if (!filtro(a)) continue;
    if (vincePunto(a.fondamentale, a.valutazione)) {
      tot += 1;
      if (servizioPerRally.get(a.rallyId) === a.squadra) bp += 1;
    } else if (perdePunto(a.fondamentale, a.valutazione)) {
      persi += 1;
    }
  }
  return { tot, bp, vp: tot - persi };
}

export interface PuntiVinti {
  batt: number;
  att: number;
  mur: number;
  erAv: number;
}

/** Punti vinti dalla squadra, per fonte: battuta, attacco, muro o errore avversario. */
export function puntiVintiPerFonte(azioni: Azione[], rallies: Rally[], squadra: Squadra): PuntiVinti {
  const azioniPerRally = raggruppaPerRally(azioni);
  const risultato: PuntiVinti = { batt: 0, att: 0, mur: 0, erAv: 0 };
  // I numeri di rally ripartono da 1 in ogni set: i doppioni si scartano set per set.
  const ralliesPerSet = new Map<string, Rally[]>();
  for (const r of rallies) ralliesPerSet.set(r.setId, [...(ralliesPerSet.get(r.setId) ?? []), r]);
  const unici = [...ralliesPerSet.values()].flatMap((r) => rallyUnici(r, azioniPerRally));
  for (const rally of unici) {
    const azioniRally = azioniPerRally.get(rally.id) ?? [];
    const esito = rally.chiusuraManuale ? rally.esito : determinaEsitoAutomatico(azioniRally);
    if (esito !== (squadra === 'A' ? 'punto_A' : 'punto_B')) continue;
    const chiusura = azioniRally
      .filter((a) => a.squadra === squadra && vincePunto(a.fondamentale, a.valutazione))
      .sort((x, y) => y.ordine - x.ordine)[0];
    if (chiusura?.fondamentale === 'battuta') risultato.batt += 1;
    else if (chiusura?.fondamentale === 'attacco') risultato.att += 1;
    else if (chiusura?.fondamentale === 'muro') risultato.mur += 1;
    else risultato.erAv += 1;
  }
  return risultato;
}

export type CellaSet =
  | { tipo: 'titolare'; posizione: 1 | 2 | 3 | 4 | 5 | 6; palleggiatore: boolean }
  | { tipo: 'entrato' }
  | null;

/** Posizione di partenza del giocatore nel set (o 'entrato' se e' subentrato / ha giocato). */
export function cellaSetGiocatore(p: {
  set: SetPallavolo;
  sostituzioni: Sostituzione[];
  azioni: Azione[];
  giocatore: Player;
}): CellaSet {
  const { set, sostituzioni, azioni, giocatore } = p;
  const squadre: [string[], string | null][] = [
    [set.formazioneInizialeA, set.paleggiatoreIdA],
    [set.formazioneInizialeB, set.paleggiatoreIdB],
  ];
  for (const [formazione, paleggiatoreId] of squadre) {
    const indice = formazione.indexOf(giocatore.id);
    if (indice >= 0) {
      return {
        tipo: 'titolare',
        posizione: (indice + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        palleggiatore: paleggiatoreId === giocatore.id,
      };
    }
  }
  const entrato =
    sostituzioni.some((s) => s.setId === set.id && s.giocatoreEntraId === giocatore.id) ||
    azioni.some((a) => a.setId === set.id && a.giocatoreId === giocatore.id);
  return entrato ? { tipo: 'entrato' } : null;
}

/** Durata del set come 'h.mm' (prima e ultima azione); '0.00' con meno di 2 azioni. */
export function durataSet(azioni: Azione[]): string {
  if (azioni.length < 2) return '0.00';
  const tempi = azioni.map((a) => new Date(a.timestamp).getTime());
  const minuti = Math.max(0, Math.round((Math.max(...tempi) - Math.min(...tempi)) / 60000));
  return `${Math.floor(minuti / 60)}.${String(minuti % 60).padStart(2, '0')}`;
}

/** Punteggio 'A-B' al primo rally in cui una squadra raggiunge 8, 16 e 21. */
export function parzialiSet(cronologia: InfoRally[]): [string | null, string | null, string | null] {
  return [8, 16, 21].map((soglia) => {
    const r = cronologia.find((c) => Math.max(c.punteggioA, c.punteggioB) >= soglia);
    return r ? `${r.punteggioA}-${r.punteggioB}` : null;
  }) as [string | null, string | null, string | null];
}
