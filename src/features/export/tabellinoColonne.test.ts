import { describe, it, expect } from 'vitest';
import { GRUPPI_TABELLINO, INIZI_GRUPPO, valoriRigaTabellino, sezioniTabellino } from './tabellinoColonne';
import { calcolaRigaGiocatore } from '@/domain/statisticheComplete';
import type { Azione, Player, Rally } from '@/domain/types';

describe('GRUPPI_TABELLINO', () => {
  it('il numero totale di sotto-colonne corrisponde ai valori prodotti da valoriRigaTabellino', () => {
    const totaleColonne = GRUPPI_TABELLINO.reduce((somma, g) => somma + g.colonne.length, 0);
    const riga = calcolaRigaGiocatore([], 'p1');
    expect(valoriRigaTabellino(riga, { tot: 0, bp: 0, vp: 0 })).toHaveLength(totaleColonne);
  });
});

describe('INIZI_GRUPPO', () => {
  it('indica la prima colonna di ogni fondamentale (dove va il separatore spesso)', () => {
    // Punti (3), Battuta (4), Ricezione (4), Attacco (6), Att. POS (4), Att. NEG (4), Contrattacco (6), Muro (4), Direzioni.
    expect([...INIZI_GRUPPO]).toEqual([0, 3, 7, 11, 17, 21, 25, 31, 35]);
  });
});

describe('GRUPPI_TABELLINO: gruppo Punti', () => {
  it('il primo gruppo e Punti con Tot, BP, V-P', () => {
    expect(GRUPPI_TABELLINO[0]).toEqual({ titolo: 'Punti', colonne: ['Tot', 'BP', 'V-P'] });
  });
});

describe('valoriRigaTabellino', () => {
  it('riporta i valori nello stesso ordine dei gruppi (punti prima, direzioni attacco ultima)', () => {
    const azioni: Azione[] = [
      {
        id: 'az1', rallyId: 'r1', setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
        fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
        origine: { x: 5, y: 50 }, destinazione: { x: 95, y: 50 }, toccoMuro: false,
        timestamp: '2026-09-16T10:00:00.000Z',
      },
    ];
    const riga = calcolaRigaGiocatore(azioni, 'p1');
    const valori = valoriRigaTabellino(riga, { tot: 7, bp: 4, vp: -2 });
    expect(valori.slice(0, 3)).toEqual([7, 4, -2]);
    // Poi Battuta (Tot,Err,Pt,Pt%): 1 tentativo, 0 errori, 1 ace, 100%.
    expect(valori.slice(3, 7)).toEqual([1, 0, 1, 100]);
  });
});

describe('sezioniTabellino', () => {
  const giocatore = (id: string, numero: number): Player => ({
    id, teamId: 't1', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true,
  });
  const giocatori = [giocatore('p1', 1), giocatore('p2', 2), giocatore('p3', 3)];

  const battuta = (id: string, setId: string, giocatoreId: string, valutazione: Azione['valutazione'], squadra: 'A' | 'B' = 'A'): Azione => ({
    id, rallyId: `r-${id}`, setId, ordine: 1, squadra, giocatoreId,
    fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione,
    origine: null, destinazione: null, toccoMuro: false, timestamp: '2026-10-09T10:00:00.000Z',
  });

  const azioni = [
    battuta('a1', 's1', 'p1', '#'),
    battuta('a2', 's1', 'p1', '+'),
    battuta('a3', 's1', 'p2', '='),
    battuta('a4', 's2', 'p2', '#'),
    battuta('a5', 's2', 'p3', '+'),
    battuta('a6', 's2', 'p3', '+', 'B'),
  ];
  const sets = [
    { id: 's1', numero: 1, punteggioA: 25, punteggioB: 21 },
    { id: 's2', numero: 2, punteggioA: 18, punteggioB: 25 },
  ];

  const rallies: Rally[] = azioni.map((a) => ({
    id: a.rallyId, setId: a.setId, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false,
  }));
  const sezioni = sezioniTabellino({ giocatori, squadra: 'A', azioni, rallies, sets });

  it('parte dalla partita intera, poi una sezione per set con il suo punteggio', () => {
    expect(sezioni.map((x) => x.titolo)).toEqual(['PARTITA INTERA', 'SET 1 (25-21)', 'SET 2 (18-25)']);
  });

  it('la partita intera elenca tutta la rosa e somma tutti i set', () => {
    const intera = sezioni[0];
    expect(intera.righe.map((r) => r.nome)).toEqual(['G1', 'G2', 'G3']);
    expect(intera.totale.slice(3, 6)).toEqual([5, 1, 2]); // 5 battute della squadra A, 1 errore, 2 ace
  });

  it('ogni set elenca solo chi ha giocato azioni in quel set e ha il suo totale', () => {
    const set1 = sezioni[1];
    expect(set1.righe.map((r) => r.nome)).toEqual(['G1', 'G2']);
    expect(set1.righe[0].valori.slice(3, 6)).toEqual([2, 0, 1]);
    expect(set1.totale.slice(3, 6)).toEqual([3, 1, 1]);

    const set2 = sezioni[2];
    expect(set2.righe.map((r) => r.nome)).toEqual(['G2', 'G3']);
    expect(set2.totale.slice(3, 6)).toEqual([2, 0, 1]); // l'azione della squadra B non conta
  });

  it('la somma dei totali dei set coincide con il totale della partita intera', () => {
    const somma = [3, 4, 5].map((i) => (sezioni[1].totale[i] as number) + (sezioni[2].totale[i] as number));
    expect(somma).toEqual(sezioni[0].totale.slice(3, 6));
  });

  it('senza set mostra solo la partita intera', () => {
    expect(sezioniTabellino({ giocatori, squadra: 'A', azioni: [], rallies: [], sets: [] }).map((x) => x.titolo)).toEqual(['PARTITA INTERA']);
  });

  it('un set senza azioni della squadra resta in elenco con riga totale a zero e nessun giocatore', () => {
    const vuoto = sezioniTabellino({ giocatori, squadra: 'A', azioni: [], rallies: [], sets: [sets[0]] })[1];
    expect(vuoto.righe).toEqual([]);
    expect(vuoto.totale.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('le colonne Punti partono la riga: ace conta come punto e break point, errore battuta in V-P', () => {
    // p1 set 1: due ace/punti (a1 '#'), a2 '+' non e un punto. p2: '=' errore.
    expect(sezioni[1].righe[0].valori.slice(0, 3)).toEqual([1, 1, 1]);
    expect(sezioni[1].righe[1].valori.slice(0, 3)).toEqual([0, 0, -1]);
    // Totale squadra del set 1: 1 punto, 1 BP, V-P = 1 - 1 = 0.
    expect(sezioni[1].totale.slice(0, 3)).toEqual([1, 1, 0]);
    // Partita intera: ace a1 e a4; errore a3.
    expect(sezioni[0].totale.slice(0, 3)).toEqual([2, 2, 1]);
  });
});
