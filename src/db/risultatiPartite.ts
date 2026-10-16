import { supabase } from '@/lib/supabase';
import { contaSetVinti } from '@/domain/matchProgress';
import type { SetPallavolo } from '@/domain/types';

/** Set vinti da A e B per ogni partita, dai set conclusi (sets.vincitore). */
export async function caricaSetVinti(matchIds: string[]): Promise<Map<string, { A: number; B: number }>> {
  const risultato = new Map<string, { A: number; B: number }>();
  matchIds.forEach((id) => risultato.set(id, { A: 0, B: 0 }));
  if (matchIds.length === 0) return risultato;
  const { data, error } = await supabase.from('sets').select('*').in('matchId', matchIds);
  if (error) throw error;
  const sets = data as SetPallavolo[];
  for (const id of matchIds) {
    risultato.set(id, contaSetVinti(sets.filter((s) => s.matchId === id)));
  }
  return risultato;
}
