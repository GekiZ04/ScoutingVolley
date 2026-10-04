import { describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';
import { creaPartita, creaSet, avviaSet, eliminaPartita, aggiornaStatoSet, aggiornaStatoPartita, salvaLiberiSelezionati } from './matches';

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

  describe('avviaSet', () => {
    const nuovaPartita = () =>
      creaPartita({
        data: '2026-09-16', squadraAId: 'sq-a', squadraBId: 'sq-b',
        squadraRiferimentoId: null, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
      });
    const formazione = (matchId: string) => ({
      matchId,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A' as const,
    });
    const righeSet = async (matchId: string) =>
      ((await supabase.from('sets').select('*').eq('matchId', matchId)).data ?? []) as { id: string; numero: number }[];

    it('crea il primo set con numero 1', async () => {
      const match = await nuovaPartita();
      const set = await avviaSet(formazione(match.id));
      expect(set.numero).toBe(1);
    });

    it('numera il set successivo dal massimo numero realmente presente, non da un conteggio', async () => {
      const match = await nuovaPartita();
      const primo = await creaSet({ ...formazione(match.id), numero: 1 });
      await aggiornaStatoSet(primo.id, 'concluso', 'A');
      const terzo = await creaSet({ ...formazione(match.id), numero: 3 });
      await aggiornaStatoSet(terzo.id, 'concluso', 'B');

      const set = await avviaSet(formazione(match.id));

      expect(set.numero).toBe(4);
    });

    it('chiamato due volte di fila non crea un secondo set vuoto: riusa quello ancora senza azioni', async () => {
      const match = await nuovaPartita();
      const primo = await avviaSet(formazione(match.id));
      const secondo = await avviaSet({ ...formazione(match.id), formazioneInizialeA: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'] });

      expect(secondo.id).toBe(primo.id);
      expect(await righeSet(match.id)).toHaveLength(1);
      // La formazione scelta per ultima vince: l'utente puo' averla corretta.
      const { data } = await supabase.from('sets').select('*').eq('id', primo.id).maybeSingle();
      expect(data?.formazioneInizialeA).toEqual(['x1', 'x2', 'x3', 'x4', 'x5', 'x6']);
    });

    it('se il set in corso ha gia azioni lo riprende invece di aprirne un altro', async () => {
      const match = await nuovaPartita();
      const inCorso = await avviaSet(formazione(match.id));
      await supabase.from('azioni').insert({ id: 'az1', setId: inCorso.id, rallyId: 'r1', ordine: 1 });

      const set = await avviaSet(formazione(match.id));

      expect(set.id).toBe(inCorso.id);
      expect(await righeSet(match.id)).toHaveLength(1);
    });

    it('dopo un set concluso ne apre uno nuovo', async () => {
      const match = await nuovaPartita();
      const primo = await avviaSet(formazione(match.id));
      await aggiornaStatoSet(primo.id, 'concluso', 'A');

      const secondo = await avviaSet(formazione(match.id));

      expect(secondo.id).not.toBe(primo.id);
      expect(secondo.numero).toBe(2);
    });
  });

  it('elimina una partita lasciando intatte le squadre', async () => {
    const { data: squadre } = await supabase.from('teams').insert({ id: 'sq-a', nome: 'A', createdAt: 'x' }).select();
    expect(squadre).toBeTruthy();
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: 'sq-a', squadraBId: 'sq-a',
      squadraRiferimentoId: null, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });

    await eliminaPartita(match.id);

    const { data: partite } = await supabase.from('matches').select('*');
    expect(partite).toHaveLength(0);
    const { data: teams } = await supabase.from('teams').select('*');
    expect(teams).toHaveLength(1);
  });
});
