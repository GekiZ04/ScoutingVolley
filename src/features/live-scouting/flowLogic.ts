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
 * Fase di posizionamento di ciascuna squadra nel rally aperto. Fino alla
 * ricezione solo chi riceve ha posizioni speciali (schierata in ricezione gia'
 * prima della battuta); finito lo scambio battuta-ricezione entrambe vanno ai
 * posti di specializzazione e ci restano fino a fine rally.
 */
export function fasiSchema(
  azioniRallyAperto: Azione[],
  squadraAlServizio: Squadra,
): Partial<Record<Squadra, FaseSchema>> {
  const ultima = azioniRallyAperto[azioniRallyAperto.length - 1];
  if (!ultima || ultima.fondamentale === 'battuta') {
    return { [squadraOpposta(squadraAlServizio)]: 'ricezione' };
  }
  return { A: 'cambio', B: 'cambio' };
}
