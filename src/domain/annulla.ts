import type { Azione, CorrezionePunteggio, Rally, Sostituzione, Timeout } from './types';

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
