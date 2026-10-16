import { determinaEsitoAutomatico } from './reducer';
import type { Azione, CorrezionePunteggio, Punto, Rally, Sostituzione, Squadra, Timeout, TipoBattuta } from './types';

export type Annullabile =
  | { tipo: 'azioni'; rallyId: string; azioneIds: string[] }
  | { tipo: 'rallyManuale'; rallyId: string; haAzioni: boolean }
  | { tipo: 'sostituzione'; id: string }
  | { tipo: 'timeout'; id: string }
  | { tipo: 'correzionePunteggio'; id: string };

// Con piu' rally dello stesso numero (doppio tocco) vale quello con piu'
// azioni, come in deriveSetState.
function rallyDelNumero(rallies: Rally[], azioni: Azione[], numero: number): Rally | undefined {
  let scelto: Rally | undefined;
  let azioniScelto = -1;
  for (const rally of rallies) {
    if (rally.numero !== numero) continue;
    const n = azioni.filter((a) => a.rallyId === rally.id).length;
    if (n > azioniScelto) {
      scelto = rally;
      azioniScelto = n;
    }
  }
  return scelto;
}

// Le due azioni di un gesto unico (battuta+ricezione, attacco+muro) vengono
// salvate con lo stesso timestamp: l'ultimo gesto e' l'insieme delle ultime
// azioni del rally che lo condividono.
function ultimoGesto(azioniRally: Azione[]): string[] {
  const ordinate = [...azioniRally].sort((a, b) => a.ordine - b.ordine);
  const ultima = ordinate[ordinate.length - 1];
  if (!ultima) return [];
  const ids: string[] = [];
  for (let i = ordinate.length - 1; i >= 0 && ordinate[i].timestamp === ultima.timestamp; i -= 1) {
    ids.unshift(ordinate[i].id);
  }
  return ids;
}

/**
 * Cosa toglie "Annulla": l'ultima cosa fatta, in ordine di recenza.
 * 1. l'ultimo gesto del rally aperto;
 * 2. cambi, timeout e correzioni fatti dopo l'ultimo punto (sono registrati
 *    "dopo il rally N" solo quando N e' gia' chiuso, quindi sono piu' recenti
 *    del punto; tra loro l'ordine non e' registrato e si usa quello fisso
 *    correzione > timeout > cambio, ultimo inserito per primo);
 * 3. l'ultimo punto: se manuale si riapre (o si elimina se non ha azioni),
 *    se automatico si toglie il gesto che lo ha chiuso.
 */
export function trovaUltimoAnnullabile(dati: {
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  correzioniPunteggio: CorrezionePunteggio[];
  rallyApertoNumero: number;
}): Annullabile | null {
  const { rallies, azioni, sostituzioni, timeouts, correzioniPunteggio, rallyApertoNumero } = dati;
  const azioniDi = (rallyId: string) => azioni.filter((a) => a.rallyId === rallyId);

  const aperto = rallyDelNumero(rallies, azioni, rallyApertoNumero);
  if (aperto) {
    const gesto = ultimoGesto(azioniDi(aperto.id));
    if (gesto.length > 0) return { tipo: 'azioni', rallyId: aperto.id, azioneIds: gesto };
  }

  const confine = rallyApertoNumero - 1;
  const correzione = correzioniPunteggio.filter((c) => c.dopoRallyNumero === confine).pop();
  if (correzione) return { tipo: 'correzionePunteggio', id: correzione.id };
  const pausa = timeouts.filter((t) => t.dopoRallyNumero === confine).pop();
  if (pausa) return { tipo: 'timeout', id: pausa.id };
  const cambio = sostituzioni.filter((s) => s.dopoRallyNumero === confine).pop();
  if (cambio) return { tipo: 'sostituzione', id: cambio.id };

  const ultimo = rallyDelNumero(rallies, azioni, confine);
  if (ultimo) {
    const azioniUltimo = azioniDi(ultimo.id);
    if (ultimo.chiusuraManuale) {
      return { tipo: 'rallyManuale', rallyId: ultimo.id, haAzioni: azioniUltimo.length > 0 };
    }
    const gesto = ultimoGesto(azioniUltimo);
    if (gesto.length > 0) return { tipo: 'azioni', rallyId: ultimo.id, azioneIds: gesto };
  }
  return null;
}

/**
 * Chiavi dei codici della striscia che il prossimo "Annulla" toglie (o
 * modifica): il gesto da togliere; se una correzione di valutazione e' ancora
 * da annullare su una di quelle azioni, solo il codice di quell'azione.
 */
export function chiaviDaAnnullare(
  bersaglio: Annullabile | null,
  azioni: Azione[],
  storiaCorrezioni: { azioneId: string; precedente: string; nuova: string }[],
): string[] {
  if (!bersaglio) return [];
  if (bersaglio.tipo === 'rallyManuale') return [`punto-${bersaglio.rallyId}`];
  if (bersaglio.tipo !== 'azioni') return [];
  const delRally = azioni.filter((a) => a.rallyId === bersaglio.rallyId);
  const chiudeOra = determinaEsitoAutomatico(delRally) !== null;
  const punto = `punto-${bersaglio.rallyId}`;
  for (let i = storiaCorrezioni.length - 1; i >= 0; i -= 1) {
    const voce = storiaCorrezioni[i];
    if (!bersaglio.azioneIds.includes(voce.azioneId)) continue;
    const attuale = azioni.find((a) => a.id === voce.azioneId);
    if (attuale?.valutazione === voce.nuova) {
      const prima = delRally.map((a) => (a.id === voce.azioneId ? { ...a, valutazione: voce.precedente as Azione['valutazione'] } : a));
      const chiudePrima = determinaEsitoAutomatico(prima) !== null;
      return chiudeOra && !chiudePrima ? [voce.azioneId, punto] : [voce.azioneId];
    }
    break;
  }
  const restano = delRally.filter((a) => !bersaglio.azioneIds.includes(a.id));
  const chiudeDopo = determinaEsitoAutomatico(restano) !== null;
  return chiudeOra && !chiudeDopo ? [...bersaglio.azioneIds, punto] : bersaglio.azioneIds;
}

// Un'azione riaperta da "Annulla" con tutti i tocchi tranne l'ultimo: il
// flusso riparte dal passo in cui era stato fatto quel tocco.
export type BozzaFlusso =
  | {
      flusso: 'battuta';
      passo: 'esito' | 'ricezione-valutazione';
      tipoBattuta: TipoBattuta;
      origine: Punto;
      destinazione: Punto;
      ricevitore?: { giocatoreId: string; squadra: Squadra };
    }
  | { flusso: 'ricezione'; passo: 'valutazione'; giocatoreId: string; squadra: Squadra }
  | {
      flusso: 'attacco';
      passo: 'destinazione' | 'muro-destinazione';
      giocatoreId: string;
      squadra: Squadra;
      origine: Punto;
      muro?: { puntoTocco: Punto; giocatoreId: string };
    };

/**
 * Bozza del flusso che aveva registrato le azioni annullate (un gesto: una
 * battuta, battuta+ricezione, una ricezione, un attacco, attacco+muro). Null
 * se mancano i dati per riaprirlo (azioni vecchie o incomplete): in quel caso
 * il flusso riparte da capo.
 */
export function bozzaDaAzioniAnnullate(azioni: Azione[]): BozzaFlusso | null {
  const [prima, seconda] = [...azioni].sort((a, b) => a.ordine - b.ordine);
  if (!prima) return null;

  if (prima.fondamentale === 'battuta') {
    if (!prima.tipoBattuta || !prima.origine || !prima.destinazione) return null;
    const comune = { flusso: 'battuta' as const, tipoBattuta: prima.tipoBattuta, origine: prima.origine, destinazione: prima.destinazione };
    if (seconda?.fondamentale === 'ricezione' && seconda.giocatoreId) {
      return {
        ...comune,
        passo: 'ricezione-valutazione',
        ricevitore: { giocatoreId: seconda.giocatoreId, squadra: seconda.squadra },
      };
    }
    return { ...comune, passo: 'esito' };
  }

  if (prima.fondamentale === 'ricezione') {
    if (!prima.giocatoreId) return null;
    return { flusso: 'ricezione', passo: 'valutazione', giocatoreId: prima.giocatoreId, squadra: prima.squadra };
  }

  if (prima.fondamentale === 'attacco') {
    if (!prima.giocatoreId || !prima.origine) return null;
    const comune = { flusso: 'attacco' as const, giocatoreId: prima.giocatoreId, squadra: prima.squadra, origine: prima.origine };
    if (seconda?.fondamentale === 'muro' && seconda.giocatoreId && seconda.origine) {
      return { ...comune, passo: 'muro-destinazione', muro: { puntoTocco: seconda.origine, giocatoreId: seconda.giocatoreId } };
    }
    return { ...comune, passo: 'destinazione' };
  }
  return null;
}
