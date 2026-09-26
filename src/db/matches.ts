import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import type { Match, SetPallavolo } from '@/domain/types';

export async function creaPartita(
  input: Omit<Match, 'id' | 'stato' | 'liberiSelezionatiA' | 'liberiSelezionatiB'>,
): Promise<Match> {
  const match: Match = {
    ...input,
    id: uuidv4(),
    stato: 'in_corso',
    liberiSelezionatiA: null,
    liberiSelezionatiB: null,
  };
  const { error } = await supabase.from('matches').insert(match);
  if (error) throw error;
  return match;
}

export async function salvaLiberiSelezionati(
  matchId: string,
  liberiSelezionatiA: string[] | null,
  liberiSelezionatiB: string[] | null,
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ liberiSelezionatiA, liberiSelezionatiB })
    .eq('id', matchId);
  if (error) throw error;
}

type CampiExtraSet = 'paleggiatoreIdA' | 'paleggiatoreIdB' | 'giroA' | 'giroB';

export async function creaSet(
  input: Omit<SetPallavolo, 'id' | 'stato' | 'vincitore' | CampiExtraSet> &
    Partial<Pick<SetPallavolo, CampiExtraSet>>,
): Promise<SetPallavolo> {
  const set: SetPallavolo = {
    ...input,
    id: uuidv4(),
    stato: 'in_corso',
    vincitore: null,
    paleggiatoreIdA: input.paleggiatoreIdA ?? null,
    paleggiatoreIdB: input.paleggiatoreIdB ?? null,
    giroA: input.giroA ?? null,
    giroB: input.giroB ?? null,
  };
  const { error } = await supabase.from('sets').insert(set);
  if (error) throw error;
  return set;
}

export async function aggiornaStatoSet(
  id: string,
  stato: SetPallavolo['stato'],
  vincitore: SetPallavolo['vincitore'],
): Promise<void> {
  const { error } = await supabase.from('sets').update({ stato, vincitore }).eq('id', id);
  if (error) throw error;
}

export async function aggiornaStatoPartita(id: string, stato: Match['stato']): Promise<void> {
  const { error } = await supabase.from('matches').update({ stato }).eq('id', id);
  if (error) throw error;
}
