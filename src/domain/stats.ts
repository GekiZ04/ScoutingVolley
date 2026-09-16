import type { Azione, Fondamentale } from './types';

export interface StatisticheFondamentale {
  tentativi: number;
  perfetti: number;
  errori: number;
  efficienzaPercento: number;
}

export function calcolaStatistiche(
  azioni: Azione[],
  fondamentale: Fondamentale,
  giocatoreId?: string,
): StatisticheFondamentale {
  const filtrate = azioni.filter(
    (a) => a.fondamentale === fondamentale && (giocatoreId === undefined || a.giocatoreId === giocatoreId),
  );
  const tentativi = filtrate.length;
  const perfetti = filtrate.filter((a) => a.valutazione === '#').length;
  const errori = filtrate.filter((a) => a.valutazione === '=').length;
  const efficienzaPercento = tentativi === 0 ? 0 : ((perfetti - errori) / tentativi) * 100;
  return { tentativi, perfetti, errori, efficienzaPercento };
}
