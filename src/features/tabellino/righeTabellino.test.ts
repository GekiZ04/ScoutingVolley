import { describe, it, expect } from 'vitest';
import { extraTabellinoSquadra } from './righeTabellino';
import type { RiepilogoPartita } from '@/db/matchSummary';
import type { Azione, Match, Player, SetPallavolo } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => ({
  id, teamId: 't1', numero, nome: id, ruolo: 'schiacciatore', attivo: true,
});

function amichevole(): RiepilogoPartita {
  const match = {
    id: 'm1', data: '2026-10-16', squadraAId: 't1', squadraBId: 't1', squadraRiferimentoId: null,
    formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15, stato: 'in_corso',
    liberiSelezionatiA: null, liberiSelezionatiB: null,
  } as Match;
  const set = {
    id: 's1', matchId: 'm1', numero: 1,
    formazioneInizialeA: ['a1'], formazioneInizialeB: ['b1'],
    primaSquadraAlServizio: 'A', stato: 'in_corso', vincitore: null,
    paleggiatoreIdA: null, paleggiatoreIdB: null, giroA: null, giroB: null,
  } as SetPallavolo;
  const azioneB2 = { id: 'x', rallyId: 'r1', setId: 's1', squadra: 'B', giocatoreId: 'b2' } as Azione;
  return {
    match,
    giocatori: [giocatore('a1', 1), giocatore('b1', 2), giocatore('b2', 3), giocatore('panchina', 4)],
    riepiloghi: [{ set, punteggioA: 0, punteggioB: 0 }],
    tutteLeAzioni: [azioneB2],
    tutteLeRallies: [],
    tutteLeSostituzioni: [],
    tutteITimeout: [],
    tutteLeCorrezioni: [],
  };
}

describe('extraTabellinoSquadra', () => {
  it('in amichevole ogni lato mostra solo chi ha giocato da quel lato', () => {
    const dati = amichevole();
    expect(extraTabellinoSquadra(dati, 'A').roster.map((g) => g.id)).toEqual(['a1']);
    expect(extraTabellinoSquadra(dati, 'B').roster.map((g) => g.id)).toEqual(['b1', 'b2']);
  });

  it('in amichevole non ripete un giocatore caricato due volte', () => {
    const dati = amichevole();
    dati.giocatori = [...dati.giocatori, ...dati.giocatori];
    expect(extraTabellinoSquadra(dati, 'A').roster.map((g) => g.id)).toEqual(['a1']);
  });
});
