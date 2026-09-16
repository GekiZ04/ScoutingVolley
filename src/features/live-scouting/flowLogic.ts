import type { Azione } from '@/domain/types';

export type PassoAtteso = 'battuta' | 'ricezione' | 'attacco' | 'bivio';

export function determinaPassoAtteso(azioniRallyAperto: Azione[]): PassoAtteso {
  if (azioniRallyAperto.length === 0) return 'battuta';
  const ultima = azioniRallyAperto[azioniRallyAperto.length - 1]!;
  if (ultima.fondamentale === 'battuta') return 'ricezione';
  if (ultima.fondamentale === 'ricezione') return 'attacco';
  return 'bivio';
}
