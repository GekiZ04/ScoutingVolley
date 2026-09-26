import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';
import { creaPartita, creaSet, aggiornaStatoSet, aggiornaStatoPartita, salvaLiberiSelezionati } from './matches';

describe('db/matches', () => {
  it('crea una partita in corso con i punti set di default', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: 'sq-a',
      formatoSet: 5,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    expect(match.stato).toBe('in_corso');
    expect(match.liberiSelezionatiA).toBeNull();
    expect(match.liberiSelezionatiB).toBeNull();
  });

  it('salva quali liberi giocano questa partita', async () => {
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: 'sq-a', squadraBId: 'sq-b',
      squadraRiferimentoId: null, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await salvaLiberiSelezionati(match.id, ['p1', 'p2'], null);
    const { data: aggiornata } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
    expect(aggiornata?.liberiSelezionatiA).toEqual(['p1', 'p2']);
    expect(aggiornata?.liberiSelezionatiB).toBeNull();
  });

  it('crea un set con formazioni iniziali e lo chiude assegnando il vincitore', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    expect(set.paleggiatoreIdA).toBeNull();
    expect(set.giroA).toBeNull();
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    const { data: aggiornato } = await supabase.from('sets').select('*').eq('id', set.id).maybeSingle();
    expect(aggiornato?.stato).toBe('concluso');
    expect(aggiornato?.vincitore).toBe('A');
  });

  it('salva palleggiatore e giro quando indicati, per squadra', async () => {
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: 'sq-a', squadraBId: 'sq-b',
      squadraRiferimentoId: null, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
      paleggiatoreIdA: 'a1',
      giroA: 'schiacciatore-centrale',
    });
    expect(set.paleggiatoreIdA).toBe('a1');
    expect(set.giroA).toBe('schiacciatore-centrale');
    expect(set.paleggiatoreIdB).toBeNull();
    expect(set.giroB).toBeNull();
  });

  it('conclude una partita', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    await aggiornaStatoPartita(match.id, 'conclusa');
    const { data: aggiornata } = await supabase.from('matches').select('*').eq('id', match.id).maybeSingle();
    expect(aggiornata?.stato).toBe('conclusa');
  });
});
