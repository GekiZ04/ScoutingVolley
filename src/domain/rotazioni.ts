import { cronologiaSet, zonaPalleggiatore } from './cronologiaSet';
import { idAzioniContrattacco } from './stats';
import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

export type FiltroRotazione = 'dopoRicezione' | 'dopoRicezionePositiva' | 'contrattacco';

export interface DatiSetRotazioni {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
}

export interface AttacchiRotazione {
  attacchi: Azione[];
  rotazioneUltima: string[] | null;
}

/**
 * Attacchi di `squadra` fatti mentre il suo palleggiatore era in `zona`
 * (rotazione P1-P6), su tutti i set dati. I set senza palleggiatore per la
 * squadra non contribuiscono.
 */
export function attacchiInRotazione(p: {
  dati: DatiSetRotazioni[];
  squadra: Squadra;
  zona: 1 | 2 | 3 | 4 | 5 | 6;
  filtro: FiltroRotazione;
}): AttacchiRotazione {
  const attacchi: Azione[] = [];
  let rotazioneUltima: string[] | null = null;

  for (const { set, rallies, azioni, sostituzioni } of p.dati) {
    const palleggiatoreId = p.squadra === 'A' ? set.paleggiatoreIdA : set.paleggiatoreIdB;
    if (!palleggiatoreId) continue;

    const rotazionePerRally = new Map<string, string[]>();
    for (const info of cronologiaSet(set, rallies, azioni, sostituzioni)) {
      const rotazione = p.squadra === 'A' ? info.rotazioneA : info.rotazioneB;
      if (zonaPalleggiatore(rotazione, palleggiatoreId) === p.zona) rotazionePerRally.set(info.rallyId, rotazione);
    }
    if (rotazionePerRally.size === 0) continue;

    const contrattacchi = idAzioniContrattacco(azioni);
    const ricezionePositiva = new Set(
      azioni
        .filter(
          (a) =>
            a.fondamentale === 'ricezione' && a.squadra === p.squadra && (a.valutazione === '#' || a.valutazione === '+'),
        )
        .map((a) => a.rallyId),
    );

    const trovati = azioni
      .filter((a) => a.fondamentale === 'attacco' && a.squadra === p.squadra && rotazionePerRally.has(a.rallyId))
      .filter((a) => {
        if (p.filtro === 'contrattacco') return contrattacchi.has(a.id);
        if (contrattacchi.has(a.id)) return false;
        return p.filtro === 'dopoRicezione' || ricezionePositiva.has(a.rallyId);
      });

    if (trovati.length > 0) {
      attacchi.push(...trovati);
      rotazioneUltima = rotazionePerRally.get(trovati[trovati.length - 1].rallyId) ?? rotazioneUltima;
    }
  }

  return { attacchi, rotazioneUltima };
}
