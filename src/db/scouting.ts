import { db } from './schema';
import type { Azione, Rally, Sostituzione, Timeout } from '@/domain/types';

export interface DatiSet {
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
}

export async function salvaRally(rally: Rally): Promise<void> {
  await db.rallies.add(rally);
}

export async function aggiornaRallyEsito(rally: Rally): Promise<void> {
  await db.rallies.put(rally);
}

export async function salvaAzione(azione: Azione): Promise<void> {
  await db.azioni.add(azione);
}

export async function eliminaAzione(id: string): Promise<void> {
  await db.azioni.delete(id);
}

export async function eliminaRallySeVuoto(rallyId: string): Promise<void> {
  const azioniRimaste = await db.azioni.where('rallyId').equals(rallyId).count();
  if (azioniRimaste === 0) {
    await db.rallies.delete(rallyId);
  }
}

export async function salvaSostituzione(sostituzione: Sostituzione): Promise<void> {
  await db.sostituzioni.add(sostituzione);
}

export async function salvaTimeout(timeout: Timeout): Promise<void> {
  await db.timeouts.add(timeout);
}

export async function caricaDatiSet(setId: string): Promise<DatiSet> {
  const [rallies, azioni, sostituzioni, timeouts] = await Promise.all([
    db.rallies.where('setId').equals(setId).sortBy('numero'),
    db.azioni.where('setId').equals(setId).toArray(),
    db.sostituzioni.where('setId').equals(setId).toArray(),
    db.timeouts.where('setId').equals(setId).toArray(),
  ]);
  azioni.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { rallies, azioni, sostituzioni, timeouts };
}
