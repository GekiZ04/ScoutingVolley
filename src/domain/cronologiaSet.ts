import { applicaSostituzione, ruotaPosizioni } from './rotation';
import { determinaEsitoAutomatico, raggruppaPerRally, rallyUnici } from './reducer';
import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

export interface InfoRally {
  rallyId: string;
  numero: number;
  squadraAlServizio: Squadra; // prima del rally
  rotazioneA: string[]; // prima del rally (index 0 = zona 1)
  rotazioneB: string[];
  vincitore: Squadra | null; // null = rally aperto
  punteggioA: number; // dopo il rally (solo rally, senza correzioni)
  punteggioB: number;
}

/**
 * Ricostruisce il set rally per rally con lo stesso ciclo di `deriveSetState`,
 * registrando per ciascun rally servizio e rotazioni PRIMA del rally (dopo le
 * sostituzioni di `dopoRallyNumero === numero - 1`) e il punteggio DOPO.
 */
export function cronologiaSet(
  set: SetPallavolo,
  rallies: Rally[],
  azioni: Azione[],
  sostituzioni: Sostituzione[],
): InfoRally[] {
  const azioniPerRally = raggruppaPerRally(azioni);
  let rotazioneA = [...set.formazioneInizialeA];
  let rotazioneB = [...set.formazioneInizialeB];
  let squadraAlServizio = set.primaSquadraAlServizio;
  let punteggioA = 0;
  let punteggioB = 0;
  const risultato: InfoRally[] = [];

  for (const rally of rallyUnici(rallies, azioniPerRally)) {
    for (const sostituzione of sostituzioni.filter((s) => s.dopoRallyNumero === rally.numero - 1)) {
      if (sostituzione.squadra === 'A') rotazioneA = applicaSostituzione(rotazioneA, sostituzione);
      else rotazioneB = applicaSostituzione(rotazioneB, sostituzione);
    }

    const prima = { squadraAlServizio, rotazioneA: [...rotazioneA], rotazioneB: [...rotazioneB] };

    const azioniRally = azioniPerRally.get(rally.id) ?? [];
    const esito = rally.chiusuraManuale ? rally.esito : determinaEsitoAutomatico(azioniRally);
    let vincitore: Squadra | null = null;

    if (esito) {
      vincitore = esito === 'punto_A' ? 'A' : 'B';
      if (vincitore === 'A') punteggioA += 1;
      else punteggioB += 1;

      if (vincitore !== squadraAlServizio) {
        if (vincitore === 'A') rotazioneA = ruotaPosizioni(rotazioneA);
        else rotazioneB = ruotaPosizioni(rotazioneB);
        squadraAlServizio = vincitore;
      }
    }

    risultato.push({ rallyId: rally.id, numero: rally.numero, ...prima, vincitore, punteggioA, punteggioB });
  }

  return risultato;
}

/** Zona (1-6) occupata dal palleggiatore nella rotazione, o null se assente/ignoto. */
export function zonaPalleggiatore(
  rotazione: string[],
  palleggiatoreId: string | null,
): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (!palleggiatoreId) return null;
  const indice = rotazione.indexOf(palleggiatoreId);
  if (indice < 0 || indice > 5) return null;
  return (indice + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
