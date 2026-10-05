import type { Azione, Fondamentale, Squadra } from './types';
import { perdePunto, raggruppaPerRally } from './reducer';

export interface StatisticheFondamentale {
  tentativi: number;
  perfetti: number;
  errori: number;
  efficienzaPercento: number;
}

// Categoria di statistiche: oltre ai quattro fondamentali registrati come tali
// (Azione.fondamentale), 'contrattacco' e' una categoria derivata a sola
// lettura, non un fondamentale a se' stante nel modello dati.
export type FondamentaleStat = Fondamentale | 'contrattacco';

// Il modello non registra la difesa come fondamentale a se' stante. E'
// 'attacco' (cambio palla, side-out) solo il primo attacco del rally fatto
// dalla squadra che ha ricevuto; ogni altro attacco arriva dopo una
// transizione ed e' un contrattacco, come in Click&Scout. Anche il primo
// attacco del rally e' un contrattacco se lo fa la squadra al servizio (es.
// ricezione che passa direttamente di la'). Senza ricezione ne' battuta nel
// rally, il primo attacco resta 'attacco'.
export function idAzioniContrattacco(azioni: Azione[]): Set<string> {
  const idContrattacco = new Set<string>();
  for (const azioniRally of raggruppaPerRally(azioni).values()) {
    const ordinate = [...azioniRally].sort((a, b) => a.ordine - b.ordine);
    const ricezione = ordinate.find((a) => a.fondamentale === 'ricezione');
    const battuta = ordinate.find((a) => a.fondamentale === 'battuta');
    const squadraRicevente: Squadra | undefined =
      ricezione?.squadra ?? (battuta ? (battuta.squadra === 'A' ? 'B' : 'A') : undefined);
    const attacchi = ordinate.filter((a) => a.fondamentale === 'attacco');
    attacchi.forEach((attacco, indice) => {
      const cambioPalla = indice === 0 && (squadraRicevente === undefined || attacco.squadra === squadraRicevente);
      if (!cambioPalla) idContrattacco.add(attacco.id);
    });
  }
  return idContrattacco;
}

export function calcolaStatistiche(
  azioni: Azione[],
  fondamentale: FondamentaleStat,
  giocatoreId?: string,
): StatisticheFondamentale {
  const idContrattacco =
    fondamentale === 'attacco' || fondamentale === 'contrattacco' ? idAzioniContrattacco(azioni) : null;
  const filtrate = azioni.filter((a) => {
    if (giocatoreId !== undefined && a.giocatoreId !== giocatoreId) return false;
    if (fondamentale === 'contrattacco') return a.fondamentale === 'attacco' && idContrattacco!.has(a.id);
    if (fondamentale === 'attacco') return a.fondamentale === 'attacco' && !idContrattacco!.has(a.id);
    return a.fondamentale === fondamentale;
  });
  const tentativi = filtrate.length;
  const perfetti = filtrate.filter((a) => a.valutazione === '#').length;
  // Errore = l'azione fa perdere il punto a chi l'ha eseguita. Include quindi
  // anche `attacco:/` (murato per punto) e `muro:/` (invasione), non solo '='.
  const errori = filtrate.filter((a) => perdePunto(a.fondamentale, a.valutazione)).length;
  const efficienzaPercento = tentativi === 0 ? 0 : ((perfetti - errori) / tentativi) * 100;
  return { tentativi, perfetti, errori, efficienzaPercento };
}

export interface RigaDistribuzionePalleggio {
  giocatoreId: string;
  tentativi: number;
  percentuale: number;
}

// Su chi il palleggiatore distribuisce l'alzata: non e' un fondamentale a se'
// (il modello non registra l'alzata), ma si deduce da chi attacca, contando
// sia il primo attacco che i contrattacchi (in entrambi i casi c'e' comunque
// stata un'alzata). Ordinata dal piu' servito al meno servito.
export function distribuzionePalleggio(azioni: Azione[], squadra: Squadra): RigaDistribuzionePalleggio[] {
  const attacchi = azioni.filter(
    (a): a is Azione & { giocatoreId: string } =>
      a.squadra === squadra && a.fondamentale === 'attacco' && a.giocatoreId !== null,
  );
  const totale = attacchi.length;
  if (totale === 0) return [];
  const conteggi = new Map<string, number>();
  for (const a of attacchi) conteggi.set(a.giocatoreId, (conteggi.get(a.giocatoreId) ?? 0) + 1);
  return [...conteggi.entries()]
    .map(([giocatoreId, tentativi]) => ({ giocatoreId, tentativi, percentuale: (tentativi / totale) * 100 }))
    .sort((a, b) => b.tentativi - a.tentativi);
}
