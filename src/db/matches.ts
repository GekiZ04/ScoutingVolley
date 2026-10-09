import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import type { Match, SetPallavolo, Squadra } from '@/domain/types';

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

type InputAvviaSet = Omit<Parameters<typeof creaSet>[0], 'numero'>;

/**
 * Punto unico da cui la schermata formazione apre un set. Leggere sempre lo
 * stato reale dal DB (non un conteggio gia' in memoria) e' cio' che evita i
 * set fantasma: un doppio tap, o "indietro + Inizia partita", prima creava
 * ogni volta un nuovo set (a volte con lo stesso numero) lasciando quelli
 * precedenti vuoti. Se l'ultimo set e' ancora in corso lo si riprende
 * (aggiornando la formazione solo se non ha ancora azioni); se ne apre uno
 * nuovo solo dopo un set concluso, numerato dal massimo realmente presente.
 */
export async function avviaSet(input: InputAvviaSet): Promise<SetPallavolo> {
  const { data, error } = await supabase.from('sets').select('*').eq('matchId', input.matchId).order('numero');
  if (error) throw error;
  const sets = data as SetPallavolo[];
  const ultimo = sets[sets.length - 1];

  if (ultimo && ultimo.stato === 'in_corso') {
    const { count, error: erroreAzioni } = await supabase
      .from('azioni')
      .select('id', { count: 'exact', head: true })
      .eq('setId', ultimo.id);
    if (erroreAzioni) throw erroreAzioni;
    if ((count ?? 0) > 0) return ultimo;

    const aggiornato: SetPallavolo = {
      ...ultimo,
      ...input,
      paleggiatoreIdA: input.paleggiatoreIdA ?? null,
      paleggiatoreIdB: input.paleggiatoreIdB ?? null,
      giroA: input.giroA ?? null,
      giroB: input.giroB ?? null,
    };
    const { error: erroreUpdate } = await supabase
      .from('sets')
      .update({
        formazioneInizialeA: aggiornato.formazioneInizialeA,
        formazioneInizialeB: aggiornato.formazioneInizialeB,
        primaSquadraAlServizio: aggiornato.primaSquadraAlServizio,
        paleggiatoreIdA: aggiornato.paleggiatoreIdA,
        paleggiatoreIdB: aggiornato.paleggiatoreIdB,
        giroA: aggiornato.giroA,
        giroB: aggiornato.giroB,
      })
      .eq('id', ultimo.id);
    if (erroreUpdate) throw erroreUpdate;
    return aggiornato;
  }

  const numero = sets.reduce((max, s) => Math.max(max, s.numero), 0) + 1;
  return creaSet({ ...input, numero });
}

// Corregge la formazione di partenza di una squadra (es. rotazione sbagliata):
// la rotazione attuale e' derivata da questa, quindi si sposta di conseguenza.
export async function aggiornaFormazioneIniziale(
  setId: string,
  squadra: Squadra,
  formazione: string[],
): Promise<void> {
  const colonna = squadra === 'A' ? 'formazioneInizialeA' : 'formazioneInizialeB';
  const { error } = await supabase.from('sets').update({ [colonna]: formazione }).eq('id', setId);
  if (error) throw error;
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

// Cancella solo la riga della partita: set, rally, azioni, sostituzioni e
// timeout spariscono con "on delete cascade" (vedi supabase/schema.sql).
// Squadre e giocatori restano: sono rose condivise tra piu' partite.
export async function eliminaPartita(id: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', id);
  if (error) throw error;
}
