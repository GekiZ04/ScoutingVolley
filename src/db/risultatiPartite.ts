import { supabase } from '@/lib/supabase';
import { contaSetVinti } from '@/domain/matchProgress';
import type { SetPallavolo } from '@/domain/types';

// Un `.in()` con troppi id finisce in un URL troppo lungo: si chiede a blocchi.
const ID_PER_RICHIESTA = 100;

/** Set vinti da A e B per ogni partita, dai set conclusi (sets.vincitore). */
export async function caricaSetVinti(matchIds: string[]): Promise<Map<string, { A: number; B: number }>> {
  const risultato = new Map<string, { A: number; B: number }>();
  matchIds.forEach((id) => risultato.set(id, { A: 0, B: 0 }));
  if (matchIds.length === 0) return risultato;
  const blocchi: string[][] = [];
  for (let i = 0; i < matchIds.length; i += ID_PER_RICHIESTA) blocchi.push(matchIds.slice(i, i + ID_PER_RICHIESTA));
  const risposte = await Promise.all(blocchi.map((ids) => supabase.from('sets').select('*').in('matchId', ids)));
  const sets: SetPallavolo[] = [];
  for (const { data, error } of risposte) {
    if (error) throw error;
    sets.push(...(data as SetPallavolo[]));
  }
  for (const id of matchIds) {
    risultato.set(id, contaSetVinti(sets.filter((s) => s.matchId === id)));
  }
  return risultato;
}
