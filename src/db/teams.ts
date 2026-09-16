import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';
import type { Player, Team } from '@/domain/types';

export async function creaSquadra(nome: string): Promise<Team> {
  const team: Team = { id: uuidv4(), nome, createdAt: new Date().toISOString() };
  await db.teams.add(team);
  return team;
}

export async function rinominaSquadra(id: string, nome: string): Promise<void> {
  await db.teams.update(id, { nome });
}

export async function eliminaSquadra(id: string): Promise<void> {
  await db.transaction('rw', db.teams, db.players, async () => {
    await db.players.where('teamId').equals(id).delete();
    await db.teams.delete(id);
  });
}

export async function aggiungiGiocatore(input: Omit<Player, 'id' | 'attivo'>): Promise<Player> {
  const player: Player = { ...input, id: uuidv4(), attivo: true };
  await db.players.add(player);
  return player;
}

export async function modificaGiocatore(
  id: string,
  modifiche: Partial<Omit<Player, 'id' | 'teamId'>>,
): Promise<void> {
  await db.players.update(id, modifiche);
}

export async function archiviaGiocatore(id: string): Promise<void> {
  await db.players.update(id, { attivo: false });
}
