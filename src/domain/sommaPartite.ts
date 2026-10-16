import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

const altro = (s: Squadra): Squadra => (s === 'A' ? 'B' : 'A');

/**
 * Porta la squadra scelta sul lato A: se `lato` e' 'B' scambia A<->B in
 * squadra, squadraAlServizio ed esito, cosi' i dati di partite in cui la
 * squadra gioca su lati diversi si possono sommare.
 */
export function normalizzaSuSquadra(
  azioni: Azione[],
  rallies: Rally[],
  lato: Squadra,
): { azioni: Azione[]; rallies: Rally[] } {
  if (lato === 'A') return { azioni, rallies };
  return {
    azioni: azioni.map((a) => ({ ...a, squadra: altro(a.squadra) })),
    rallies: rallies.map((r) => ({
      ...r,
      squadraAlServizio: altro(r.squadraAlServizio),
      esito: r.esito === null ? null : r.esito === 'punto_A' ? 'punto_B' : 'punto_A',
    })),
  };
}

export function normalizzaSostituzioni(sostituzioni: Sostituzione[], lato: Squadra): Sostituzione[] {
  if (lato === 'A') return sostituzioni;
  return sostituzioni.map((s) => ({ ...s, squadra: altro(s.squadra) }));
}

/** Set con i campi per squadra scambiati se `lato` e' 'B' (la squadra scelta diventa A). */
export function normalizzaSet(set: SetPallavolo, lato: Squadra): SetPallavolo {
  if (lato === 'A') return set;
  return {
    ...set,
    formazioneInizialeA: set.formazioneInizialeB,
    formazioneInizialeB: set.formazioneInizialeA,
    paleggiatoreIdA: set.paleggiatoreIdB,
    paleggiatoreIdB: set.paleggiatoreIdA,
    giroA: set.giroB,
    giroB: set.giroA,
    primaSquadraAlServizio: altro(set.primaSquadraAlServizio),
    vincitore: set.vincitore === null ? null : altro(set.vincitore),
  };
}
