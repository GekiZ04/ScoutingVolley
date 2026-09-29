import { describe, it, expect } from 'vitest';
import { GRUPPI_TABELLINO, valoriRigaTabellino } from './tabellinoColonne';
import { calcolaRigaGiocatore } from '@/domain/statisticheComplete';
import type { Azione } from '@/domain/types';

describe('GRUPPI_TABELLINO', () => {
  it('il numero totale di sotto-colonne corrisponde ai valori prodotti da valoriRigaTabellino', () => {
    const totaleColonne = GRUPPI_TABELLINO.reduce((somma, g) => somma + g.colonne.length, 0);
    const riga = calcolaRigaGiocatore([], 'p1');
    expect(valoriRigaTabellino(riga)).toHaveLength(totaleColonne);
  });
});

describe('valoriRigaTabellino', () => {
  it('riporta i valori nello stesso ordine dei gruppi (battuta prima, direzioni attacco ultima)', () => {
    const azioni: Azione[] = [
      {
        id: 'az1', rallyId: 'r1', setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
        fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
        origine: { x: 5, y: 50 }, destinazione: { x: 95, y: 50 }, toccoMuro: false,
        timestamp: '2026-09-16T10:00:00.000Z',
      },
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    const valori = valoriRigaTabellino(riga);
    // Prime 4 colonne = Battuta (Tot,Err,Pt,Pt%): 1 tentativo, 0 errori, 1 ace, 100%.
    expect(valori.slice(0, 4)).toEqual([1, 0, 1, 100]);
  });
});
