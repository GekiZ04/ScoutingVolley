import type { Azione } from './types';
import { raggruppaPerRally } from './reducer';

export type Direzione = 'parallela' | 'diagonale' | 'centro';
export type Colonna = 'sinistra' | 'centro' | 'destra';

const COLONNA_ORIGINE: Record<number, Colonna> = {
  4: 'sinistra', 5: 'sinistra',
  3: 'centro', 6: 'centro',
  2: 'destra', 1: 'destra',
};

const COLONNA_DESTINAZIONE: Record<number, Colonna> = {
  7: 'sinistra', 4: 'sinistra', 5: 'sinistra',
  8: 'centro', 3: 'centro', 6: 'centro',
  9: 'destra', 2: 'destra', 1: 'destra',
};

export function classificaDirezione(zonaOrigine: number, zonaDestinazione: number): Direzione {
  const colonnaOrigine = COLONNA_ORIGINE[zonaOrigine];
  const colonnaDestinazione = COLONNA_DESTINAZIONE[zonaDestinazione];
  if (colonnaOrigine === undefined || colonnaDestinazione === undefined) {
    throw new Error(`Zona non valida: origine=${zonaOrigine} destinazione=${zonaDestinazione}`);
  }
  if (colonnaOrigine === 'centro' || colonnaDestinazione === 'centro') return 'centro';
  return colonnaOrigine === colonnaDestinazione ? 'parallela' : 'diagonale';
}

export function isMurato(azioneAttacco: Azione, azioniSuccessiveStessoRally: Azione[]): boolean {
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
    if (attacco.valutazione === '=') errori += 1;
    if (attacco.zona !== null && attacco.direzione !== null) {
      const direzione = classificaDirezione(attacco.zona, attacco.direzione);
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
): Record<number, number> {
  const attacchi = tutteLeAzioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && a.direzione !== null,
  );
  const distribuzione: Record<number, number> = {};
  for (const attacco of attacchi) {
    const zona = attacco.direzione as number;
    distribuzione[zona] = (distribuzione[zona] ?? 0) + 1;
  }
  return distribuzione;
}
