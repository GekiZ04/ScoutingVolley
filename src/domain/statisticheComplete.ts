import type { Azione, Valutazione } from './types';
import { raggruppaPerRally } from './reducer';
import { idAzioniContrattacco } from './stats';
import { classificaDirezione } from './analysis';

export interface StatFondamentale {
  tot: number;
  err: number;
  pt: number;
  ptPercento: number;
}

export interface StatRicezione {
  tot: number;
  err: number;
  posPercento: number;
  prfPercento: number;
}

export interface StatAttacco extends StatFondamentale {
  mur: number;
  efficienzaPercento: number;
}

export interface Direzioni {
  parallelaPercento: number;
  diagonalePercento: number;
  centroPercento: number;
}

export interface RigaStatisticheGiocatore {
  giocatoreId: string;
  battuta: StatFondamentale;
  ricezione: StatRicezione;
  attacco: StatAttacco;
  attaccoDopoRicezionePositiva: StatFondamentale;
  attaccoDopoRicezioneNegativa: StatFondamentale;
  contrattacco: StatAttacco;
  muro: StatFondamentale;
  direzioniAttacco: Direzioni;
}

const percento = (parte: number, totale: number): number => (totale === 0 ? 0 : (parte / totale) * 100);

function calcolaStatBattuta(azioni: Azione[], giocatoreId: string): StatFondamentale {
  const filtrate = azioni.filter((a) => a.fondamentale === 'battuta' && a.giocatoreId === giocatoreId);
  const tot = filtrate.length;
  const err = filtrate.filter((a) => a.valutazione === '=').length;
  const pt = filtrate.filter((a) => a.valutazione === '#').length;
  return { tot, err, pt, ptPercento: percento(pt, tot) };
}

function calcolaStatRicezione(azioni: Azione[], giocatoreId: string): StatRicezione {
  const filtrate = azioni.filter((a) => a.fondamentale === 'ricezione' && a.giocatoreId === giocatoreId);
  const tot = filtrate.length;
  const err = filtrate.filter((a) => a.valutazione === '=').length;
  const perfette = filtrate.filter((a) => a.valutazione === '#').length;
  const positive = perfette + filtrate.filter((a) => a.valutazione === '+').length;
  return { tot, err, posPercento: percento(positive, tot), prfPercento: percento(perfette, tot) };
}

// Attacco e contrattacco condividono la stessa struttura di colonne
// (Tot/Err/Mur/Pt/Pt%/Efficienza%): Err = errore diretto ('='), Mur = murato
// per punto ('/'), tenuti separati come nel referto Click&Scout invece di
// sommarli in un'unica colonna "errori" come fa domain/stats.ts.
function calcolaStatAttaccoOContrattacco(
  azioni: Azione[],
  giocatoreId: string,
  idContrattacco: Set<string>,
  vuoiContrattacco: boolean,
): StatAttacco {
  const filtrate = azioni.filter(
    (a) =>
      a.fondamentale === 'attacco' &&
      a.giocatoreId === giocatoreId &&
      idContrattacco.has(a.id) === vuoiContrattacco,
  );
  const tot = filtrate.length;
  const err = filtrate.filter((a) => a.valutazione === '=').length;
  const mur = filtrate.filter((a) => a.valutazione === '/').length;
  const pt = filtrate.filter((a) => a.valutazione === '#').length;
  return { tot, err, mur, pt, ptPercento: percento(pt, tot), efficienzaPercento: percento(pt - err - mur, tot) };
}

function calcolaStatMuro(azioni: Azione[], giocatoreId: string): StatFondamentale {
  const filtrate = azioni.filter((a) => a.fondamentale === 'muro' && a.giocatoreId === giocatoreId);
  const tot = filtrate.length;
  const err = filtrate.filter((a) => a.valutazione === '/').length;
  const pt = filtrate.filter((a) => a.valutazione === '#').length;
  return { tot, err, pt, ptPercento: percento(pt, tot) };
}

const RICEZIONE_POSITIVA: Valutazione[] = ['#', '+'];

/**
 * Split dell'attacco (non del contrattacco: il contrattacco non segue una
 * ricezione ma una difesa/transizione) in base alla qualita' della ricezione
 * dello stesso rally e della stessa squadra, come "Attacchi su Ricezioni POS"
 * nel referto Click&Scout.
 */
function calcolaAttaccoDopoRicezione(
  azioni: Azione[],
  giocatoreId: string,
  idContrattacco: Set<string>,
  azioniPerRally: Map<string, Azione[]>,
): { positiva: StatFondamentale; negativa: StatFondamentale } {
  const attacchi = azioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && !idContrattacco.has(a.id),
  );
  const positiveAz: Azione[] = [];
  const negativeAz: Azione[] = [];
  for (const attacco of attacchi) {
    const azioniRally = azioniPerRally.get(attacco.rallyId) ?? [];
    const ricezione = azioniRally.find(
      (a) => a.fondamentale === 'ricezione' && a.squadra === attacco.squadra && a.ordine < attacco.ordine,
    );
    if (!ricezione) continue;
    (RICEZIONE_POSITIVA.includes(ricezione.valutazione) ? positiveAz : negativeAz).push(attacco);
  }
  const riga = (lista: Azione[]): StatFondamentale => {
    const tot = lista.length;
    const err = lista.filter((a) => a.valutazione === '=').length;
    const pt = lista.filter((a) => a.valutazione === '#').length;
    return { tot, err, pt, ptPercento: percento(pt, tot) };
  };
  return { positiva: riga(positiveAz), negativa: riga(negativeAz) };
}

function calcolaDirezioni(azioni: Azione[], giocatoreId: string): Direzioni {
  const attacchi = azioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && a.origine && a.destinazione,
  );
  const tot = attacchi.length;
  if (tot === 0) return { parallelaPercento: 0, diagonalePercento: 0, centroPercento: 0 };
  let parallela = 0;
  let diagonale = 0;
  let centro = 0;
  for (const a of attacchi) {
    const direzione = classificaDirezione(a.origine!, a.destinazione!);
    if (direzione === 'parallela') parallela += 1;
    else if (direzione === 'diagonale') diagonale += 1;
    else centro += 1;
  }
  return {
    parallelaPercento: percento(parallela, tot),
    diagonalePercento: percento(diagonale, tot),
    centroPercento: percento(centro, tot),
  };
}

export function calcolaRigaGiocatore(azioni: Azione[], giocatoreId: string): RigaStatisticheGiocatore {
  const idContrattacco = idAzioniContrattacco(azioni);
  const azioniPerRally = raggruppaPerRally(azioni);
  const dopoRicezione = calcolaAttaccoDopoRicezione(azioni, giocatoreId, idContrattacco, azioniPerRally);
  return {
    giocatoreId,
    battuta: calcolaStatBattuta(azioni, giocatoreId),
    ricezione: calcolaStatRicezione(azioni, giocatoreId),
    attacco: calcolaStatAttaccoOContrattacco(azioni, giocatoreId, idContrattacco, false),
    contrattacco: calcolaStatAttaccoOContrattacco(azioni, giocatoreId, idContrattacco, true),
    attaccoDopoRicezionePositiva: dopoRicezione.positiva,
    attaccoDopoRicezioneNegativa: dopoRicezione.negativa,
    muro: calcolaStatMuro(azioni, giocatoreId),
    direzioniAttacco: calcolaDirezioni(azioni, giocatoreId),
  };
}
