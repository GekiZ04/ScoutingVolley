import { cronologiaSet } from './cronologiaSet';
import { idAzioniContrattacco } from './stats';
import type { Azione, CorrezionePunteggio, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

/**
 * Distribuzione del palleggio per il tabellino: su chi la squadra ha
 * attaccato (ogni attacco presuppone un'alzata), divisa per qualita' della
 * ricezione e per fase del set.
 *
 * - totale: tutti gli attacchi, cambio palla e contrattacco;
 * - ricPositiva / ricNegativa: primo attacco dopo la propria ricezione,
 *   positiva = # o +, negativa = ! - / (con = non c'e' attacco);
 * - da0a10 / da10a20 / da20: tutti gli attacchi, per punteggio prima del
 *   rally, guardando la squadra avanti (0-9, 10-19, da 20 in su).
 */
export type ColonnaDistribuzione = 'totale' | 'ricPositiva' | 'ricNegativa' | 'da0a10' | 'da10a20' | 'da20';

export const COLONNE_DISTRIBUZIONE: { chiave: ColonnaDistribuzione; etichetta: string }[] = [
  { chiave: 'totale', etichetta: 'Totale' },
  { chiave: 'ricPositiva', etichetta: 'Ric. positiva' },
  { chiave: 'ricNegativa', etichetta: 'Ric. negativa' },
  { chiave: 'da0a10', etichetta: '0-10' },
  { chiave: 'da10a20', etichetta: '10-20' },
  { chiave: 'da20', etichetta: '20-25' },
];

export interface DatiSetDistribuzione {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  correzioni: CorrezionePunteggio[];
}

export type ConteggiDistribuzione = Record<ColonnaDistribuzione, number>;

export interface RigaDistribuzione {
  giocatoreId: string;
  conteggi: ConteggiDistribuzione;
}

export interface DistribuzionePalleggio {
  righe: RigaDistribuzione[];
  totali: ConteggiDistribuzione;
}

const vuoti = (): ConteggiDistribuzione => ({ totale: 0, ricPositiva: 0, ricNegativa: 0, da0a10: 0, da10a20: 0, da20: 0 });

function fascia(puntiMax: number): ColonnaDistribuzione {
  if (puntiMax < 10) return 'da0a10';
  if (puntiMax < 20) return 'da10a20';
  return 'da20';
}

export function distribuzionePerFasce(dati: DatiSetDistribuzione[], squadra: Squadra): DistribuzionePalleggio {
  const perGiocatore = new Map<string, ConteggiDistribuzione>();
  const totali = vuoti();

  for (const { set, rallies, azioni, sostituzioni, correzioni } of dati) {
    // Punteggio prima di ogni rally: quello dopo, meno il punto del rally.
    const puntiPrima = new Map<string, number>();
    for (const info of cronologiaSet(set, rallies, azioni, sostituzioni, correzioni)) {
      const a = info.punteggioA - (info.vincitore === 'A' ? 1 : 0);
      const b = info.punteggioB - (info.vincitore === 'B' ? 1 : 0);
      puntiPrima.set(info.rallyId, Math.max(a, b, 0));
    }

    const contrattacchi = idAzioniContrattacco(azioni);
    const ricezionePerRally = new Map<string, Azione>();
    for (const a of azioni) {
      if (a.fondamentale === 'ricezione' && a.squadra === squadra && !ricezionePerRally.has(a.rallyId)) {
        ricezionePerRally.set(a.rallyId, a);
      }
    }

    for (const a of azioni) {
      if (a.fondamentale !== 'attacco' || a.squadra !== squadra || !a.giocatoreId) continue;
      const colonne: ColonnaDistribuzione[] = ['totale'];
      const ricezione = ricezionePerRally.get(a.rallyId);
      if (ricezione && !contrattacchi.has(a.id)) {
        colonne.push(ricezione.valutazione === '#' || ricezione.valutazione === '+' ? 'ricPositiva' : 'ricNegativa');
      }
      const punti = puntiPrima.get(a.rallyId);
      if (punti !== undefined) colonne.push(fascia(punti));

      const conteggi = perGiocatore.get(a.giocatoreId) ?? vuoti();
      perGiocatore.set(a.giocatoreId, conteggi);
      for (const c of colonne) {
        conteggi[c] += 1;
        totali[c] += 1;
      }
    }
  }

  const righe = [...perGiocatore.entries()]
    .map(([giocatoreId, conteggi]) => ({ giocatoreId, conteggi }))
    .sort((x, y) => y.conteggi.totale - x.conteggi.totale);
  return { righe, totali };
}
