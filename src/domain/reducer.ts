import { ruotaPosizioni, applicaSostituzione } from './rotation';
import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

export interface SetStatoDerivato {
  punteggioA: number;
  punteggioB: number;
  rotazioneA: string[];
  rotazioneB: string[];
  squadraAlServizio: Squadra;
  rallyApertoNumero: number;
}

type ChiaveChiusura = `${Azione['fondamentale']}:${Azione['valutazione']}`;

const TABELLA_CHIUSURA: Partial<Record<ChiaveChiusura, 'esecutore' | 'avversario'>> = {
  'battuta:=': 'avversario',
  'ricezione:=': 'avversario',
  'attacco:#': 'esecutore',
  'attacco:=': 'avversario',
  'muro:#': 'esecutore',
  'muro:=': 'avversario',
};

export function squadraOpposta(squadra: Squadra): Squadra {
  return squadra === 'A' ? 'B' : 'A';
}

export function raggruppaPerRally(azioni: Azione[]): Map<string, Azione[]> {
  const mappa = new Map<string, Azione[]>();
  for (const azione of azioni) {
    const lista = mappa.get(azione.rallyId) ?? [];
    lista.push(azione);
    mappa.set(azione.rallyId, lista);
  }
  return mappa;
}

export function determinaEsitoAutomatico(azioniRally: Azione[]): 'punto_A' | 'punto_B' | null {
  for (const azione of azioniRally) {
    const chiave: ChiaveChiusura = `${azione.fondamentale}:${azione.valutazione}`;
    const risultato = TABELLA_CHIUSURA[chiave];
    if (risultato === 'esecutore') {
      return azione.squadra === 'A' ? 'punto_A' : 'punto_B';
    }
    if (risultato === 'avversario') {
      return squadraOpposta(azione.squadra) === 'A' ? 'punto_A' : 'punto_B';
    }
  }
  return null;
}

export function deriveSetState(
  set: SetPallavolo,
  rallies: Rally[],
  azioniPerRally: Map<string, Azione[]>,
  sostituzioni: Sostituzione[],
): SetStatoDerivato {
  let rotazioneA = [...set.formazioneInizialeA];
  let rotazioneB = [...set.formazioneInizialeB];
  let squadraAlServizio = set.primaSquadraAlServizio;
  let punteggioA = 0;
  let punteggioB = 0;

  const rallyOrdinati = [...rallies].sort((a, b) => a.numero - b.numero);

  const applicaSostituzioniDopo = (numeroRally: number) => {
    for (const sostituzione of sostituzioni.filter((s) => s.dopoRallyNumero === numeroRally)) {
      if (sostituzione.squadra === 'A') rotazioneA = applicaSostituzione(rotazioneA, sostituzione);
      else rotazioneB = applicaSostituzione(rotazioneB, sostituzione);
    }
  };

  for (const rally of rallyOrdinati) {
    applicaSostituzioniDopo(rally.numero - 1);

    const azioniRally = azioniPerRally.get(rally.id) ?? [];
    const esito = rally.chiusuraManuale ? rally.esito : determinaEsitoAutomatico(azioniRally);
    if (!esito) continue;

    const vincitore: Squadra = esito === 'punto_A' ? 'A' : 'B';
    if (vincitore === 'A') punteggioA += 1;
    else punteggioB += 1;

    if (vincitore !== squadraAlServizio) {
      if (vincitore === 'A') rotazioneA = ruotaPosizioni(rotazioneA);
      else rotazioneB = ruotaPosizioni(rotazioneB);
      squadraAlServizio = vincitore;
    }
  }

  const ultimoRally = rallyOrdinati[rallyOrdinati.length - 1];
  const ultimoNumero = ultimoRally?.numero ?? 0;
  applicaSostituzioniDopo(ultimoNumero);

  // L'ultimo rally dell'elenco puo' essere gia' chiuso (allora il rally
  // aperto e' quello successivo, non ancora creato) oppure essere esso
  // stesso il rally corrente ancora aperto (nessun esito determinato).
  let rallyApertoNumero: number;
  if (!ultimoRally) {
    rallyApertoNumero = 1;
  } else {
    const azioniUltimoRally = azioniPerRally.get(ultimoRally.id) ?? [];
    const esitoUltimoRally = ultimoRally.chiusuraManuale
      ? ultimoRally.esito
      : determinaEsitoAutomatico(azioniUltimoRally);
    rallyApertoNumero = esitoUltimoRally ? ultimoNumero + 1 : ultimoNumero;
  }

  return {
    punteggioA,
    punteggioB,
    rotazioneA,
    rotazioneB,
    squadraAlServizio,
    rallyApertoNumero,
  };
}
