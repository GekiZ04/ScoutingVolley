import { supabase } from '@/lib/supabase';
import type { Azione, CorrezionePunteggio, Rally, Sostituzione, Timeout } from '@/domain/types';

export interface DatiSet {
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  correzioniPunteggio: CorrezionePunteggio[];
}

export async function salvaRally(rally: Rally): Promise<void> {
  const { error } = await supabase.from('rallies').insert(rally);
  if (error) throw error;
}

export async function aggiornaRallyEsito(rally: Rally): Promise<void> {
  const { error } = await supabase.from('rallies').upsert(rally);
  if (error) throw error;
}

export async function salvaAzione(azione: Azione): Promise<void> {
  const { error } = await supabase.from('azioni').insert(azione);
  if (error) throw error;
}

export async function aggiornaValutazioneAzione(id: string, valutazione: Azione['valutazione']): Promise<void> {
  const { error } = await supabase.from('azioni').update({ valutazione }).eq('id', id);
  if (error) throw error;
}

export async function eliminaAzione(id: string): Promise<void> {
  const { error } = await supabase.from('azioni').delete().eq('id', id);
  if (error) throw error;
}

export async function eliminaAzioni(ids: string[]): Promise<void> {
  const { error } = await supabase.from('azioni').delete().in('id', ids);
  if (error) throw error;
}

export async function eliminaRallySeVuoto(rallyId: string): Promise<void> {
  const { count, error } = await supabase
    .from('azioni')
    .select('id', { count: 'exact', head: true })
    .eq('rallyId', rallyId);
  if (error) throw error;
  if ((count ?? 0) === 0) {
    const { error: erroreDelete } = await supabase.from('rallies').delete().eq('id', rallyId);
    if (erroreDelete) throw erroreDelete;
  }
}

export async function salvaSostituzione(sostituzione: Sostituzione): Promise<void> {
  const { error } = await supabase.from('sostituzioni').insert(sostituzione);
  if (error) throw error;
}

export async function salvaTimeout(timeout: Timeout): Promise<void> {
  const { error } = await supabase.from('timeouts').insert(timeout);
  if (error) throw error;
}

export async function eliminaSostituzione(id: string): Promise<void> {
  const { error } = await supabase.from('sostituzioni').delete().eq('id', id);
  if (error) throw error;
}

export async function eliminaTimeout(id: string): Promise<void> {
  const { error } = await supabase.from('timeouts').delete().eq('id', id);
  if (error) throw error;
}

// La tabella correzioni_punteggio e' stata aggiunta dopo le altre: finche'
// supabase/schema.sql non e' stato eseguito sul database non esiste. Chi legge
// la tratta come vuota, chi scrive riceve un messaggio che spiega cosa fare.
function tabellaMancante(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

export async function salvaCorrezionePunteggio(correzione: CorrezionePunteggio): Promise<void> {
  const { error } = await supabase.from('correzioni_punteggio').insert(correzione);
  if (tabellaMancante(error)) {
    throw new Error('Correzione punteggio non disponibile: esegui supabase/schema.sql nel SQL Editor di Supabase.');
  }
  if (error) throw error;
}

export async function eliminaCorrezionePunteggio(id: string): Promise<void> {
  const { error } = await supabase.from('correzioni_punteggio').delete().eq('id', id);
  if (error && !tabellaMancante(error)) throw error;
}

// Tutte le azioni della partita (tutti i set, non solo quello caricato in
// live scouting): serve per le statistiche che devono restare cumulate tra
// i set, come la distribuzione del palleggio.
export async function caricaAzioniPartita(matchId: string): Promise<Azione[]> {
  const { data: sets, error: erroreSets } = await supabase.from('sets').select('id').eq('matchId', matchId);
  if (erroreSets) throw erroreSets;
  const setIds = (sets ?? []).map((s) => s.id as string);
  if (setIds.length === 0) return [];
  const { data: azioni, error: erroreAzioni } = await supabase.from('azioni').select('*').in('setId', setIds);
  if (erroreAzioni) throw erroreAzioni;
  return azioni as Azione[];
}

export async function caricaDatiSet(setId: string): Promise<DatiSet> {
  const [rallieRes, azioniRes, sostituzioniRes, timeoutsRes, correzioniRes] = await Promise.all([
    supabase.from('rallies').select('*').eq('setId', setId).order('numero'),
    supabase.from('azioni').select('*').eq('setId', setId),
    supabase.from('sostituzioni').select('*').eq('setId', setId),
    supabase.from('timeouts').select('*').eq('setId', setId),
    supabase.from('correzioni_punteggio').select('*').eq('setId', setId),
  ]);
  if (rallieRes.error) throw rallieRes.error;
  if (azioniRes.error) throw azioniRes.error;
  if (sostituzioniRes.error) throw sostituzioniRes.error;
  if (timeoutsRes.error) throw timeoutsRes.error;
  if (correzioniRes.error && !tabellaMancante(correzioniRes.error)) throw correzioniRes.error;

  const rallies = rallieRes.data as Rally[];
  const azioni = azioniRes.data as Azione[];
  const numeroRallyPerRallyId = new Map(rallies.map((r) => [r.id, r.numero]));
  azioni.sort((a, b) => {
    const numeroA = numeroRallyPerRallyId.get(a.rallyId) ?? 0;
    const numeroB = numeroRallyPerRallyId.get(b.rallyId) ?? 0;
    if (numeroA !== numeroB) return numeroA - numeroB;
    return a.ordine - b.ordine;
  });
  return {
    rallies,
    azioni,
    sostituzioni: sostituzioniRes.data as Sostituzione[],
    timeouts: timeoutsRes.data as Timeout[],
    correzioniPunteggio: (correzioniRes.error ? [] : correzioniRes.data) as CorrezionePunteggio[],
  };
}
