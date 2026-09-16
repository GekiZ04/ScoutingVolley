import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';
import type { Match, SetPallavolo } from '@/domain/types';

export async function creaPartita(input: Omit<Match, 'id' | 'stato'>): Promise<Match> {
  const match: Match = { ...input, id: uuidv4(), stato: 'in_corso' };
  await db.matches.add(match);
  return match;
}

export async function creaSet(
  input: Omit<SetPallavolo, 'id' | 'stato' | 'vincitore'>,
): Promise<SetPallavolo> {
  const set: SetPallavolo = { ...input, id: uuidv4(), stato: 'in_corso', vincitore: null };
  await db.sets.add(set);
  return set;
}

export async function aggiornaStatoSet(
  id: string,
  stato: SetPallavolo['stato'],
  vincitore: SetPallavolo['vincitore'],
): Promise<void> {
  await db.sets.update(id, { stato, vincitore });
}

export async function aggiornaStatoPartita(id: string, stato: Match['stato']): Promise<void> {
  await db.matches.update(id, { stato });
}
