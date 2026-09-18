import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import type { Player, Team } from '@/domain/types';

export async function creaSquadra(nome: string): Promise<Team> {
  const team: Team = { id: uuidv4(), nome, createdAt: new Date().toISOString() };
  const { error } = await supabase.from('teams').insert(team);
  if (error) throw error;
  return team;
}

export async function rinominaSquadra(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('teams').update({ nome }).eq('id', id);
  if (error) throw error;
}

export async function eliminaSquadra(id: string): Promise<void> {
  const { error: errorePlayers } = await supabase.from('players').delete().eq('teamId', id);
  if (errorePlayers) throw errorePlayers;
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw error;
}

export async function aggiungiGiocatore(input: Omit<Player, 'id' | 'attivo'>): Promise<Player> {
  const player: Player = { ...input, id: uuidv4(), attivo: true };
  const { error } = await supabase.from('players').insert(player);
  if (error) throw error;
  return player;
}

export async function modificaGiocatore(
  id: string,
  modifiche: Partial<Omit<Player, 'id' | 'teamId'>>,
): Promise<void> {
  const { error } = await supabase.from('players').update(modifiche).eq('id', id);
  if (error) throw error;
}

export async function archiviaGiocatore(id: string): Promise<void> {
  const { error } = await supabase.from('players').update({ attivo: false }).eq('id', id);
  if (error) throw error;
}
