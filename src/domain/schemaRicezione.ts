import { RETE_X, LINEA_TRE_METRI_A } from './courtPositions';
import type { Giro, Punto, Squadra } from './types';

/**
 * Posizioni dei giocatori in ricezione e in attacco dopo la ricezione, per le
 * 6 rotazioni (= zona del palleggiatore). Schema "ricezione a 3 con due
 * laterali e libero".
 *
 * Fonte dei dati: rotazionivolley (https://github.com/napo/rotazionivolley,
 * Apache License 2.0), a sua volta basato su VBRotations di Andy Edwards.
 * Coordinate originali dello stage, arrotondate; vengono convertite qui sotto
 * nel nostro campo.
 */
export type FaseSchema = 'ricezione' | 'attacco';

// Ordine degli slot dentro ogni riga: P, S1, C2, O, S2, C1.
type Riga = [number, number][];

const DATI: Record<FaseSchema, Record<number, Riga>> = {
  ricezione: {
    1: [[480, 383], [450, 298], [235, 134], [104, 161], [149, 304], [230, 330]],
    2: [[454, 43], [166, 285], [105, 133], [180, 447], [297, 357], [429, 283]],
    3: [[318, 33], [144, 281], [225, 350], [372, 429], [433, 294], [421, 157]],
    4: [[102, 34], [292, 372], [350, 300], [469, 451], [177, 316], [131, 116]],
    5: [[224, 98], [292, 371], [350, 300], [485, 110], [163, 304], [108, 29]],
    6: [[306, 101], [389, 304], [446, 103], [261, 31], [155, 284], [225, 350]],
  },
  attacco: {
    1: [[378, 36], [477, 37], [289, 35], [107, 33], [316, 228], [125, 200]],
    2: [[381, 33], [129, 37], [284, 35], [493, 203], [283, 254], [100, 250]],
    3: [[384, 35], [112, 40], [125, 300], [474, 36], [336, 214], [282, 40]],
    4: [[368, 27], [332, 223], [150, 300], [474, 24], [119, 22], [272, 26]],
    5: [[362, 41], [313, 201], [100, 250], [479, 44], [141, 38], [271, 42]],
    6: [[371, 30], [315, 200], [274, 31], [474, 31], [110, 29], [150, 250]],
  },
};

type Slot = 'P' | 'S1' | 'C2' | 'O' | 'S2' | 'C1';
const ORDINE_SLOT: Slot[] = ['P', 'S1', 'C2', 'O', 'S2', 'C1'];

// Slot di ciascun giocatore in ordine di zona crescente a partire dal
// palleggiatore. Giro S-C = ordine originale dello schema; giro C-S = lo
// schema specchiato lateralmente (stesso insieme di giocatori letto in senso
// opposto), con rotazione specchiata (1<->5, 2<->4) e ascisse invertite.
const SLOT_PER_GIRO: Record<Giro, { slot: Slot[]; specchiato: boolean }> = {
  'schiacciatore-centrale': { slot: ['P', 'S1', 'C2', 'O', 'S2', 'C1'], specchiato: false },
  'centrale-schiacciatore': { slot: ['P', 'C1', 'S2', 'O', 'C2', 'S1'], specchiato: true },
};
const ROTAZIONE_SPECCHIATA: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 6 };

// Campo dello stage originale: rete in alto (y=-15), fondo a y=520, linea dei
// 3 metri a y=200, larghezza da x=75 a x=525.
const CAMPO = { xMin: 75, larghezza: 450, yRete: -15, profondita: 535, yTreMetri: 200 };
const FRAZIONE_TRE_METRI_ORIGINALE = (CAMPO.yTreMetri - CAMPO.yRete) / CAMPO.profondita;
const FRAZIONE_TRE_METRI_NOSTRA = (RETE_X - LINEA_TRE_METRI_A) / RETE_X;

// I marker hanno raggio 4: restano a distanza dalla rete e dai bordi laterali
// per non uscire dal campo o toccare la rete.
const PROFONDITA_MIN = 0.09;
const PROFONDITA_MAX = 0.95;
const LATERALE_MIN = 0.1;
const LATERALE_MAX = 0.9;

function limita(valore: number, min: number, max: number): number {
  return Math.min(Math.max(valore, min), max);
}

// Mappa la profondita' per tratti, cosi' "davanti alla linea dei 3 metri"
// resta davanti anche se il nostro campo ha la linea in posizione diversa.
function profondita(yStage: number): number {
  const d = (yStage - CAMPO.yRete) / CAMPO.profondita;
  if (d <= FRAZIONE_TRE_METRI_ORIGINALE) {
    return (d / FRAZIONE_TRE_METRI_ORIGINALE) * FRAZIONE_TRE_METRI_NOSTRA;
  }
  const resto = (d - FRAZIONE_TRE_METRI_ORIGINALE) / (1 - FRAZIONE_TRE_METRI_ORIGINALE);
  return FRAZIONE_TRE_METRI_NOSTRA + resto * (1 - FRAZIONE_TRE_METRI_NOSTRA);
}

function convertiPunto(stage: [number, number], squadra: Squadra, specchiato: boolean): Punto {
  let laterale = (stage[0] - CAMPO.xMin) / CAMPO.larghezza;
  if (specchiato) laterale = 1 - laterale;
  laterale = limita(laterale, LATERALE_MIN, LATERALE_MAX);
  const d = limita(profondita(stage[1]), PROFONDITA_MIN, PROFONDITA_MAX);

  const x = RETE_X * (1 - d);
  const y = laterale * 100;
  return squadra === 'A' ? { x, y } : { x: 100 - x, y: 100 - y };
}

/**
 * Posizioni (nel nostro campo 0-100) dei 6 giocatori in campo per la fase
 * indicata, nello stesso ordine della rotazione (indice = zona - 1). Null se
 * non si puo' calcolare (palleggiatore o giro mancanti, palleggiatore fuori
 * rotazione): in quel caso il chiamante usa le posizioni fisse per zona.
 *
 * `rotazione` e' quella reale (non quella con il libero): il libero, quando
 * c'e', prende semplicemente il posto del centrale che sostituisce.
 */
export function posizioniSchema(params: {
  squadra: Squadra;
  fase: FaseSchema;
  rotazione: string[];
  palleggiatoreId: string | null;
  giro: Giro | null;
}): Punto[] | null {
  const { squadra, fase, rotazione, palleggiatoreId, giro } = params;
  if (!palleggiatoreId || !giro) return null;
  const indicePalleggiatore = rotazione.indexOf(palleggiatoreId);
  if (indicePalleggiatore === -1) return null;

  const { slot, specchiato } = SLOT_PER_GIRO[giro];
  const zonaPalleggiatore = indicePalleggiatore + 1;
  const chiaveRotazione = specchiato ? ROTAZIONE_SPECCHIATA[zonaPalleggiatore] : zonaPalleggiatore;
  const riga = DATI[fase][chiaveRotazione];

  const risultato: Punto[] = new Array(6);
  for (let offset = 0; offset < 6; offset += 1) {
    const indiceZona = (indicePalleggiatore + offset) % 6;
    const coordinate = riga[ORDINE_SLOT.indexOf(slot[offset])];
    risultato[indiceZona] = convertiPunto(coordinate, squadra, specchiato);
  }
  return risultato;
}
