import { supabase } from '@/lib/supabase';
import { contaSetVinti, squadraCheHaVintoLaPartita } from '@/domain/matchProgress';
import type { SetPallavolo } from '@/domain/types';

/**
 * Percorso per riprendere la rilevazione: scout dell'ultimo set se ancora
 * aperto (o, a partita decisa, dell'ultimo set), altrimenti scelta della formazione per un nuovo set.
 */
export async function percorsoRilevazione(matchId: string, formatoSet: 3 | 5): Promise<string> {
  const { data, error } = await supabase.from('sets').select('*').eq('matchId', matchId).order('numero');
  if (error) throw error;
  const sets = data as SetPallavolo[];
  const ultimoSet = sets[sets.length - 1];
  // Partita gia' decisa: non si apre un nuovo set, si torna all'ultimo.
  const vinti = contaSetVinti(sets);
  if (ultimoSet && squadraCheHaVintoLaPartita(vinti.A, vinti.B, formatoSet)) {
    return `/partite/${matchId}/scouting/${ultimoSet.id}`;
  }
  if (!ultimoSet || ultimoSet.stato === 'concluso') return `/partite/${matchId}/formazione`;
  return `/partite/${matchId}/scouting/${ultimoSet.id}`;
}
