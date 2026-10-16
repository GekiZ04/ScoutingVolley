import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { creaSquadra } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { caricaSetVinti } from './risultatiPartite';

describe('caricaSetVinti', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('chiede i set a blocchi di 100 partite e conta i set vinti', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-10-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: null, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'B');
    // 249 partite inventate + quella vera in fondo: 3 richieste.
    const ids = [...Array.from({ length: 249 }, (_, i) => `finta-${i}`), match.id];
    const spia = vi.spyOn(supabase, 'from');

    const risultato = await caricaSetVinti(ids);

    expect(spia.mock.calls.filter(([tabella]) => tabella === 'sets')).toHaveLength(3);
    expect(risultato.get(match.id)).toEqual({ A: 0, B: 1 });
    expect(risultato.get('finta-0')).toEqual({ A: 0, B: 0 });
    expect(risultato.size).toBe(250);
  });

  it('propaga l errore di una richiesta', async () => {
    vi.spyOn(supabase, 'from').mockImplementation(
      () => ({ select: () => ({ in: async () => ({ data: null, error: new Error('rete giu') }) }) }) as never,
    );
    await expect(caricaSetVinti(['x'])).rejects.toThrow('rete giu');
  });
});
