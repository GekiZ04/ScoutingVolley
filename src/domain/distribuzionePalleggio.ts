import { attacchiPerAnalisi, type ZonaAttacco } from './analisiAttacco';
import { cronologiaSet, zonaPalleggiatore } from './cronologiaSet';
import { idAzioniContrattacco } from './stats';
import type { Azione, CorrezionePunteggio, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

/**
 * Distribuzione del palleggio per il tabellino: su chi e da dove la squadra
 * ha attaccato (ogni attacco presuppone un'alzata), divisa per qualita'
 * della ricezione e per fase del set.
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

export type Rotazione = 1 | 2 | 3 | 4 | 5 | 6;

/** Un attacco della squadra con tutto quello che serve alle viste di distribuzione. */
export interface AttaccoClassificato {
  azione: Azione & { giocatoreId: string };
  colonne: Set<ColonnaDistribuzione>;
  contrattacco: boolean;
  // Zona del palleggiatore (P1-P6) prima del rally; null senza palleggiatore.
  rotazione: Rotazione | null;
  // Zona da cui parte l'attacco; null senza coordinate.
  zona: ZonaAttacco | null;
}

const vuoti = (): ConteggiDistribuzione => ({ totale: 0, ricPositiva: 0, ricNegativa: 0, da0a10: 0, da10a20: 0, da20: 0 });

function fascia(puntiMax: number): ColonnaDistribuzione {
  if (puntiMax < 10) return 'da0a10';
  if (puntiMax < 20) return 'da10a20';
  return 'da20';
}

const positiva = (a: Azione) => a.valutazione === '#' || a.valutazione === '+';

export function classificaAttacchi(dati: DatiSetDistribuzione[], squadra: Squadra): AttaccoClassificato[] {
  const risultato: AttaccoClassificato[] = [];
  for (const { set, rallies, azioni, sostituzioni, correzioni } of dati) {
    const palleggiatoreId = squadra === 'A' ? set.paleggiatoreIdA : set.paleggiatoreIdB;
    // Prima di ogni rally: punteggio (quello dopo, meno il punto del rally) e rotazione.
    const puntiPrima = new Map<string, number>();
    const rotazionePrima = new Map<string, Rotazione | null>();
    for (const info of cronologiaSet(set, rallies, azioni, sostituzioni, correzioni)) {
      const a = info.punteggioA - (info.vincitore === 'A' ? 1 : 0);
      const b = info.punteggioB - (info.vincitore === 'B' ? 1 : 0);
      puntiPrima.set(info.rallyId, Math.max(a, b, 0));
      const rotazione = squadra === 'A' ? info.rotazioneA : info.rotazioneB;
      rotazionePrima.set(info.rallyId, zonaPalleggiatore(rotazione, palleggiatoreId, sostituzioni, squadra));
    }

    const contrattacchi = idAzioniContrattacco(azioni);
    const zonaPerId = new Map(attacchiPerAnalisi(azioni, rallies).map((x) => [x.id, x.zona]));
    const ricezionePerRally = new Map<string, Azione>();
    for (const a of azioni) {
      if (a.fondamentale === 'ricezione' && a.squadra === squadra && !ricezionePerRally.has(a.rallyId)) {
        ricezionePerRally.set(a.rallyId, a);
      }
    }

    for (const a of azioni) {
      if (a.fondamentale !== 'attacco' || a.squadra !== squadra || !a.giocatoreId) continue;
      const colonne = new Set<ColonnaDistribuzione>(['totale']);
      const contrattacco = contrattacchi.has(a.id);
      const ricezione = ricezionePerRally.get(a.rallyId);
      if (ricezione && !contrattacco) colonne.add(positiva(ricezione) ? 'ricPositiva' : 'ricNegativa');
      const punti = puntiPrima.get(a.rallyId);
      if (punti !== undefined) colonne.add(fascia(punti));
      risultato.push({
        azione: a as Azione & { giocatoreId: string },
        colonne,
        contrattacco,
        rotazione: rotazionePrima.get(a.rallyId) ?? null,
        zona: zonaPerId.get(a.id) ?? null,
      });
    }
  }
  return risultato;
}

export function distribuzionePerFasce(dati: DatiSetDistribuzione[], squadra: Squadra): DistribuzionePalleggio {
  const perGiocatore = new Map<string, ConteggiDistribuzione>();
  const totali = vuoti();
  for (const { azione, colonne } of classificaAttacchi(dati, squadra)) {
    const conteggi = perGiocatore.get(azione.giocatoreId) ?? vuoti();
    perGiocatore.set(azione.giocatoreId, conteggi);
    for (const c of colonne) {
      conteggi[c] += 1;
      totali[c] += 1;
    }
  }
  const righe = [...perGiocatore.entries()]
    .map(([giocatoreId, conteggi]) => ({ giocatoreId, conteggi }))
    .sort((x, y) => y.conteggi.totale - x.conteggi.totale);
  return { righe, totali };
}

// ---------------------------------------------------------------------------
// Esito di un gruppo di attacchi, come nei riquadri di Click&Scout e DataVolley.
export interface EsitoAttacchi {
  tot: number;
  punti: number; // #
  errori: number; // =
  murati: number; // /
}

export function esitoAttacchi(attacchi: Azione[]): EsitoAttacchi {
  return {
    tot: attacchi.length,
    punti: attacchi.filter((a) => a.valutazione === '#').length,
    errori: attacchi.filter((a) => a.valutazione === '=').length,
    murati: attacchi.filter((a) => a.valutazione === '/').length,
  };
}

/** Efficienza (# - / - =) / tot e kill (#) / tot, in percentuale intera. */
export const efficienza = (e: EsitoAttacchi) => (e.tot ? Math.round(((e.punti - e.murati - e.errori) / e.tot) * 100) : 0);
export const kill = (e: EsitoAttacchi) => (e.tot ? Math.round((e.punti / e.tot) * 100) : 0);

// Ordine delle rotazioni come in Click&Scout.
export const ROTAZIONI_CLICK: Rotazione[] = [1, 6, 5, 4, 3, 2];

export type FiltroRotazioni = ColonnaDistribuzione | 'contrattacco';

/**
 * Distribuzione per rotazione e zona d'attacco (stile Click&Scout): per ogni
 * rotazione P1-P6 gli attacchi partiti da ciascuna zona, su tutti i set dati.
 * Gli attacchi senza palleggiatore del set o senza coordinate non entrano.
 */
export function distribuzionePerRotazione(
  dati: DatiSetDistribuzione[],
  squadra: Squadra,
  filtro: FiltroRotazioni,
): Map<Rotazione, Map<ZonaAttacco, EsitoAttacchi>> {
  const attacchi = classificaAttacchi(dati, squadra).filter(
    (x) => x.rotazione !== null && x.zona !== null && (filtro === 'contrattacco' ? x.contrattacco : x.colonne.has(filtro)),
  );
  const celle = new Map<Rotazione, Map<ZonaAttacco, EsitoAttacchi>>();
  for (const r of ROTAZIONI_CLICK) {
    const perZona = new Map<ZonaAttacco, EsitoAttacchi>();
    const diRotazione = attacchi.filter((x) => x.rotazione === r);
    for (const z of [4, 3, 2, 5, 6, 1] as ZonaAttacco[]) {
      const diZona = diRotazione.filter((x) => x.zona === z).map((x) => x.azione);
      if (diZona.length) perZona.set(z, esitoAttacchi(diZona));
    }
    celle.set(r, perZona);
  }
  return celle;
}

/**
 * Riepilogo "cambio palla diretto" (stile DataVolley): primo attacco dopo
 * ricezione positiva/negativa, contrattacco, punti in cambio palla e in
 * break point, e differenza punti per rotazione.
 */
export interface RiepilogoCambioPalla {
  ricPositiva: EsitoAttacchi;
  ricNegativa: EsitoAttacchi;
  contrattacco: EsitoAttacchi;
  ricezioni: number;
  puntiCambioPalla: number;
  battute: number;
  puntiBreak: number;
  // Punti fatti meno subiti con il palleggiatore in P1..P6; null senza palleggiatore.
  diffRotazione: Record<Rotazione, number> | null;
}

export function riepilogoCambioPalla(dati: DatiSetDistribuzione[], squadra: Squadra): RiepilogoCambioPalla {
  const attacchi = classificaAttacchi(dati, squadra);
  const di = (f: (x: AttaccoClassificato) => boolean) => esitoAttacchi(attacchi.filter(f).map((x) => x.azione));
  const diff: Record<Rotazione, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let conPalleggiatore = false;
  let ricezioni = 0;
  let battute = 0;
  let puntiCambioPalla = 0;
  let puntiBreak = 0;

  for (const { set, rallies, azioni, sostituzioni, correzioni } of dati) {
    ricezioni += azioni.filter((a) => a.squadra === squadra && a.fondamentale === 'ricezione').length;
    battute += azioni.filter((a) => a.squadra === squadra && a.fondamentale === 'battuta').length;
    const palleggiatoreId = squadra === 'A' ? set.paleggiatoreIdA : set.paleggiatoreIdB;
    if (palleggiatoreId) conPalleggiatore = true;
    for (const info of cronologiaSet(set, rallies, azioni, sostituzioni, correzioni)) {
      if (!info.vincitore) continue;
      const vinto = info.vincitore === squadra;
      if (vinto && info.squadraAlServizio === squadra) puntiBreak += 1;
      if (vinto && info.squadraAlServizio !== squadra) puntiCambioPalla += 1;
      const rotazione = zonaPalleggiatore(
        squadra === 'A' ? info.rotazioneA : info.rotazioneB,
        palleggiatoreId,
        sostituzioni,
        squadra,
      );
      if (rotazione) diff[rotazione] += vinto ? 1 : -1;
    }
  }

  return {
    ricPositiva: di((x) => x.colonne.has('ricPositiva')),
    ricNegativa: di((x) => x.colonne.has('ricNegativa')),
    contrattacco: di((x) => x.contrattacco),
    ricezioni,
    puntiCambioPalla,
    battute,
    puntiBreak,
    diffRotazione: conPalleggiatore ? diff : null,
  };
}
