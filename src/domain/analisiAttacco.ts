import { classificaEsitoAttacco, type EsitoAttacco } from './analysis';
import { LINEA_TRE_METRI_A, RETE_X } from './courtPositions';
import { determinaEsitoAutomatico, raggruppaPerRally } from './reducer';
import { idAzioniContrattacco } from './stats';
import type { Azione, Punto, Rally, Squadra, Valutazione } from './types';

/**
 * Analisi degli attacchi in stile "attacking analysis" (Science Untangled):
 * mappa di calore e griglia da 1 m degli arrivi, ventagli di angoli, kill %
 * per angolo in ricezione e in transizione, traiettorie singole.
 *
 * Tutto e' riportato al punto di vista di chi attacca, in metri: x laterale
 * 0..9 (0 = sinistra dell'attaccante), y profondita' con 0 = fondo campo
 * avversario e 9 = rete; oltre 9 si e' nel campo di chi attacca.
 */

export type ZonaAttacco = 4 | 3 | 2 | 5 | 6 | 1;
export type FaseAttacco = 'ricezione' | 'transizione';

export interface AttaccoAnalisi {
  id: string;
  giocatoreId: string | null;
  squadra: Squadra;
  setId: string;
  valutazione: Valutazione;
  esito: EsitoAttacco;
  fase: FaseAttacco;
  zona: ZonaAttacco;
  toccoMuro: boolean;
  origine: Punto;
  arrivo: Punto;
  // Se la squadra che attacca ha vinto il rally; null se l'esito non e' noto.
  puntoVinto: boolean | null;
}

const METRI_PER_UNITA_LATERALE = 9 / 100;
const METRI_PER_UNITA_PROFONDITA = 9 / (100 - RETE_X);

// Gli attacchi della squadra B si girano (riflesso rispetto al centro) cosi'
// tutti vanno dal campo di sinistra (A) verso quello di destra.
function verso(punto: Punto, squadra: Squadra): Punto {
  return squadra === 'A' ? punto : { x: 100 - punto.x, y: 100 - punto.y };
}

function inMetri(punto: Punto): Punto {
  return {
    x: punto.y * METRI_PER_UNITA_LATERALE,
    y: 9 - (punto.x - RETE_X) * METRI_PER_UNITA_PROFONDITA,
  };
}

// Zona da cui parte l'attacco, dalla posizione di partenza (gia' nel verso
// della squadra A): davanti alla linea dei 3 metri 4-3-2, dietro 5-6-1.
export function zonaDiPartenza(origine: Punto): ZonaAttacco {
  const primaLinea = origine.x >= LINEA_TRE_METRI_A;
  if (origine.y < 33.33) return primaLinea ? 4 : 5;
  if (origine.y > 66.66) return primaLinea ? 2 : 1;
  return primaLinea ? 3 : 6;
}

export function attacchiPerAnalisi(azioni: Azione[], rallies: Rally[] = []): AttaccoAnalisi[] {
  const contrattacchi = idAzioniContrattacco(azioni);
  const perRally = raggruppaPerRally(azioni);
  const rallyPerId = new Map(rallies.map((r) => [r.id, r]));

  const vincitore = (rallyId: string): Squadra | null => {
    const rally = rallyPerId.get(rallyId);
    const esito =
      rally?.chiusuraManuale && rally.esito
        ? rally.esito
        : determinaEsitoAutomatico([...(perRally.get(rallyId) ?? [])].sort((a, b) => a.ordine - b.ordine));
    if (!esito) return null;
    return esito === 'punto_A' ? 'A' : 'B';
  };

  return azioni
    .filter((a) => a.fondamentale === 'attacco' && a.origine && a.destinazione)
    .map((a) => {
      const origine = verso(a.origine!, a.squadra);
      const chiVince = vincitore(a.rallyId);
      return {
        id: a.id,
        giocatoreId: a.giocatoreId,
        squadra: a.squadra,
        setId: a.setId,
        valutazione: a.valutazione,
        esito: classificaEsitoAttacco(a.valutazione),
        fase: contrattacchi.has(a.id) ? 'transizione' : 'ricezione',
        zona: zonaDiPartenza(origine),
        toccoMuro: a.toccoMuro,
        origine: inMetri(origine),
        arrivo: inMetri(verso(a.destinazione!, a.squadra)),
        puntoVinto: chiVince === null ? null : chiVince === a.squadra,
      };
    });
}

export interface FiltriAttacco {
  squadra?: Squadra | null;
  giocatoreId?: string | null;
  zona?: ZonaAttacco | null;
  fase?: FaseAttacco | null;
  setId?: string | null;
}

export function filtraAttacchi(attacchi: AttaccoAnalisi[], filtri: FiltriAttacco): AttaccoAnalisi[] {
  return attacchi.filter(
    (a) =>
      (!filtri.squadra || a.squadra === filtri.squadra) &&
      (!filtri.giocatoreId || a.giocatoreId === filtri.giocatoreId) &&
      (!filtri.zona || a.zona === filtri.zona) &&
      (!filtri.fase || a.fase === filtri.fase) &&
      (!filtri.setId || a.setId === filtri.setId),
  );
}

const percento = (parte: number, totale: number) => (totale === 0 ? 0 : (parte / totale) * 100);

export function riepilogoAttacchi(attacchi: AttaccoAnalisi[]): {
  totale: number;
  killPercento: number;
  efficienzaPercento: number;
  puntoVintoPercento: number | null;
} {
  const totale = attacchi.length;
  const punti = attacchi.filter((a) => a.esito === 'punto').length;
  const errori = attacchi.filter((a) => a.esito === 'errore').length;
  const noti = attacchi.filter((a) => a.puntoVinto !== null);
  return {
    totale,
    killPercento: percento(punti, totale),
    efficienzaPercento: percento(punti - errori, totale),
    puntoVintoPercento: noti.length === 0 ? null : percento(noti.filter((a) => a.puntoVinto).length, noti.length),
  };
}

const dentroCampo = (p: Punto) => p.x >= 0 && p.x <= 9 && p.y >= 0 && p.y <= 9;

// Arrivi nel campo avversario in quadrati da 1 m: celle[riga][colonna], riga 0
// = fondo campo, colonna 0 = sinistra di chi attacca.
export function griglia1m(attacchi: AttaccoAnalisi[]): { celle: number[][]; fuori: number; totale: number } {
  const celle = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
  let fuori = 0;
  for (const a of attacchi) {
    if (!dentroCampo(a.arrivo)) {
      fuori += 1;
      continue;
    }
    celle[Math.min(8, Math.floor(a.arrivo.y))][Math.min(8, Math.floor(a.arrivo.x))] += 1;
  }
  return { celle, fuori, totale: attacchi.length };
}

export interface SettoreAngolo {
  daGradi: number;
  aGradi: number;
  n: number;
  percentuale: number;
  killPercento: number;
}

// Angolo rispetto alla perpendicolare alla rete: 0 = dritto, positivo verso
// la destra di chi attacca. Null se la palla non va in avanti.
export function angoloAttacco(a: AttaccoAnalisi): number | null {
  const dx = a.arrivo.x - a.origine.x;
  const avanti = a.origine.y - a.arrivo.y;
  if (avanti <= 0) return null;
  return (Math.atan2(dx, avanti) * 180) / Math.PI;
}

export function settoriAngolo(
  attacchi: AttaccoAnalisi[],
  ampiezzaGradi = 15,
): { settori: SettoreAngolo[]; origineMedia: Punto | null; validi: number } {
  const numero = Math.round(180 / ampiezzaGradi);
  const conteggi = Array.from({ length: numero }, () => ({ n: 0, punti: 0 }));
  const validi: AttaccoAnalisi[] = [];
  for (const a of attacchi) {
    const angolo = angoloAttacco(a);
    if (angolo === null) continue;
    const indice = Math.min(numero - 1, Math.max(0, Math.floor((angolo + 90) / ampiezzaGradi)));
    conteggi[indice].n += 1;
    if (a.esito === 'punto') conteggi[indice].punti += 1;
    validi.push(a);
  }
  const settori = conteggi.map((c, i) => ({
    daGradi: -90 + i * ampiezzaGradi,
    aGradi: -90 + (i + 1) * ampiezzaGradi,
    n: c.n,
    percentuale: percento(c.n, validi.length),
    killPercento: percento(c.punti, c.n),
  }));
  const origineMedia =
    validi.length === 0
      ? null
      : {
          x: validi.reduce((s, a) => s + a.origine.x, 0) / validi.length,
          y: validi.reduce((s, a) => s + a.origine.y, 0) / validi.length,
        };
  return { settori, origineMedia, validi: validi.length };
}

// Mappa di calore degli arrivi: somma di gaussiane su una griglia fine che
// copre il campo avversario con un po' di margine, normalizzata a 1 nel
// punto piu' caldo.
export function densitaArrivi(
  attacchi: AttaccoAnalisi[],
  passo = 0.25,
  sigma = 0.6,
): { x0: number; y0: number; passo: number; valori: number[][] } {
  const x0 = -0.5;
  const y0 = -0.5;
  const colonne = Math.round(10 / passo);
  const righe = Math.round(9.5 / passo);
  const valori = Array.from({ length: righe }, () => Array<number>(colonne).fill(0));
  const arrivi = attacchi.map((a) => a.arrivo).filter((p) => p.y <= 9.5);
  const dueSigmaQuadro = 2 * sigma * sigma;
  let massimo = 0;
  for (let r = 0; r < righe; r += 1) {
    const cy = y0 + (r + 0.5) * passo;
    for (let c = 0; c < colonne; c += 1) {
      const cx = x0 + (c + 0.5) * passo;
      let somma = 0;
      for (const p of arrivi) somma += Math.exp(-((p.x - cx) ** 2 + (p.y - cy) ** 2) / dueSigmaQuadro);
      valori[r][c] = somma;
      if (somma > massimo) massimo = somma;
    }
  }
  if (massimo > 0) for (const riga of valori) for (let c = 0; c < riga.length; c += 1) riga[c] /= massimo;
  return { x0, y0, passo, valori };
}
