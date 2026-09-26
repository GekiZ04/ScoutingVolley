import type { Azione, Punto, Valutazione } from './types';
import { raggruppaPerRally, perdePunto } from './reducer';

export type EsitoAttacco = 'punto' | 'errore' | 'difeso';

// Punto (nero) = attacco vincente ('#'). Errore (rosso) = fa perdere il punto
// a chi attacca ('=' diretto, '/' murato per punto). Difeso (blu) = la
// squadra avversaria lo tiene in gioco (qualunque altra valutazione), come
// nei referti Click&Scout allegati dall'utente.
export function classificaEsitoAttacco(valutazione: Valutazione): EsitoAttacco {
  if (valutazione === '#') return 'punto';
  if (perdePunto('attacco', valutazione)) return 'errore';
  return 'difeso';
}

export type Direzione = 'parallela' | 'diagonale' | 'centro';
export type Colonna = 'sinistra' | 'centro' | 'destra';

export function fasciaLaterale(y: number): Colonna {
  if (y < 33.33) return 'sinistra';
  if (y > 66.66) return 'destra';
  return 'centro';
}

export function classificaDirezione(origine: Punto, destinazione: Punto): Direzione {
  const fasciaOrigine = fasciaLaterale(origine.y);
  const fasciaDestinazione = fasciaLaterale(destinazione.y);
  if (fasciaOrigine === 'centro' || fasciaDestinazione === 'centro') return 'centro';
  return fasciaOrigine === fasciaDestinazione ? 'parallela' : 'diagonale';
}

export function isMurato(azioneAttacco: Azione, azioniSuccessiveStessoRally: Azione[]): boolean {
  if (azioneAttacco.toccoMuro) return true;
  return azioniSuccessiveStessoRally.some(
    (a) => a.fondamentale === 'muro' && a.valutazione === '#' && a.squadra !== azioneAttacco.squadra,
  );
}

export interface TendenzeAttaccante {
  giocatoreId: string;
  tentativi: number;
  percParallela: number;
  percDiagonale: number;
  percCentro: number;
  percMurato: number;
  percErrore: number;
  colpoPrincipale: Direzione | null;
  allerta: boolean;
}

const SOGLIA_ALLERTA_DEFAULT = 30;

export function analizzaTendenze(
  tutteLeAzioni: Azione[],
  giocatoreId: string,
  sogliaAllertaPercento: number = SOGLIA_ALLERTA_DEFAULT,
): TendenzeAttaccante {
  const azioniPerRally = raggruppaPerRally(tutteLeAzioni);
  const attacchi = tutteLeAzioni.filter((a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId);
  const tentativi = attacchi.length;

  if (tentativi === 0) {
    return {
      giocatoreId, tentativi: 0, percParallela: 0, percDiagonale: 0, percCentro: 0,
      percMurato: 0, percErrore: 0, colpoPrincipale: null, allerta: false,
    };
  }

  let parallela = 0, diagonale = 0, centro = 0, murati = 0, errori = 0;

  for (const attacco of attacchi) {
    // '=' (errore diretto) e '/' (murato per punto) fanno entrambi perdere il
    // punto all'attaccante: vedi `TABELLA_CHIUSURA` in domain/reducer.ts.
    if (perdePunto(attacco.fondamentale, attacco.valutazione)) errori += 1;
    const origine = attacco.origine;
    const destinazione = attacco.destinazione;
    if (origine !== null && destinazione !== null) {
      const direzione = classificaDirezione(origine, destinazione);
      if (direzione === 'parallela') parallela += 1;
      else if (direzione === 'diagonale') diagonale += 1;
      else centro += 1;
    }
    const azioniRally = azioniPerRally.get(attacco.rallyId) ?? [];
    const indice = azioniRally.indexOf(attacco);
    const successive = azioniRally.slice(indice + 1);
    if (isMurato(attacco, successive)) murati += 1;
  }

  const percParallela = (parallela / tentativi) * 100;
  const percDiagonale = (diagonale / tentativi) * 100;
  const percCentro = (centro / tentativi) * 100;
  const percMurato = (murati / tentativi) * 100;
  const percErrore = (errori / tentativi) * 100;

  const direzioni: [Direzione, number][] = [
    ['parallela', percParallela],
    ['diagonale', percDiagonale],
    ['centro', percCentro],
  ];
  const colpoPrincipale = direzioni.reduce((max, corrente) => (corrente[1] > max[1] ? corrente : max))[0];

  return {
    giocatoreId, tentativi, percParallela, percDiagonale, percCentro, percMurato, percErrore,
    colpoPrincipale, allerta: percErrore + percMurato > sogliaAllertaPercento,
  };
}

export function distribuzioneDirezioniAttacco(
  tutteLeAzioni: Azione[],
  giocatoreId: string,
): Record<Colonna, number> {
  const attacchi = tutteLeAzioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && a.destinazione !== null,
  );
  const distribuzione: Record<Colonna, number> = { sinistra: 0, centro: 0, destra: 0 };
  for (const attacco of attacchi) {
    if (attacco.destinazione === null) continue;
    const colonna = fasciaLaterale(attacco.destinazione.y);
    distribuzione[colonna] += 1;
  }
  return distribuzione;
}
