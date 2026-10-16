import { supabase } from '@/lib/supabase';
import type { SetPallavolo } from '@/domain/types';

/**
 * Percorso per riprendere la rilevazione: scout dell'ultimo set se ancora
 * aperto, altrimenti scelta della formazione per un nuovo set.
 */
export async function percorsoRilevazione(matchId: string): Promise<string> {
  const { data, error } = await supabase.from('sets').select('*').eq('matchId', matchId).order('numero');
  if (error) throw error;
  const sets = data as SetPallavolo[];
  const ultimoSet = sets[sets.length - 1];
  if (!ultimoSet || ultimoSet.stato === 'concluso') return `/partite/${matchId}/formazione`;
  return `/partite/${matchId}/scouting/${ultimoSet.id}`;
}
