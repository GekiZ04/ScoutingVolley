import { squadraOpposta } from '@/domain/reducer';
import type { FaseSchema } from '@/domain/schemaRicezione';
import type { Azione, Squadra } from '@/domain/types';

export type PassoAtteso = 'battuta' | 'ricezione' | 'attacco';

export function determinaPassoAtteso(azioniRallyAperto: Azione[]): PassoAtteso {
  if (azioniRallyAperto.length === 0) return 'battuta';
  const ultima = azioniRallyAperto[azioniRallyAperto.length - 1]!;
  if (ultima.fondamentale === 'battuta') return 'ricezione';
  return 'attacco';
}

/**
 * Quale squadra cambia posizione sul campo e in quale fase: chi riceve e'
 * schierato nello schema di ricezione gia' prima della battuta e fino alla
 * ricezione, poi si sposta nello schema di attacco. Dal primo attacco in poi
 * nessuna squadra ha posizioni speciali.
 */
export function faseSchemaSquadra(
  azioniRallyAperto: Azione[],
  squadraAlServizio: Squadra,
): { squadra: Squadra; fase: FaseSchema } | null {
  const ultima = azioniRallyAperto[azioniRallyAperto.length - 1];
  if (!ultima) return { squadra: squadraOpposta(squadraAlServizio), fase: 'ricezione' };
  if (ultima.fondamentale === 'battuta') return { squadra: squadraOpposta(ultima.squadra), fase: 'ricezione' };
  if (ultima.fondamentale === 'ricezione') return { squadra: ultima.squadra, fase: 'attacco' };
  return null;
}
