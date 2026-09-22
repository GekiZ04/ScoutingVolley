import { supabase } from '@/lib/supabase';
import type { Azione, Rally, Sostituzione, Timeout } from '@/domain/types';

export interface DatiSet {
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
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

export async function caricaDatiSet(setId: string): Promise<DatiSet> {
  const [rallieRes, azioniRes, sostituzioniRes, timeoutsRes] = await Promise.all([
    supabase.from('rallies').select('*').eq('setId', setId).order('numero'),
    supabase.from('azioni').select('*').eq('setId', setId),
    supabase.from('sostituzioni').select('*').eq('setId', setId),
    supabase.from('timeouts').select('*').eq('setId', setId),
  ]);
  if (rallieRes.error) throw rallieRes.error;
  if (azioniRes.error) throw azioniRes.error;
  if (sostituzioniRes.error) throw sostituzioniRes.error;
  if (timeoutsRes.error) throw timeoutsRes.error;

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
  };
}
