import { describe, it, expect } from 'vitest';
import { indiciCentrali, liberoDaUsarePerCambioAutomatico, rotazioneConCambioAutomatico } from './liberoAutoSwap';
import type { Player } from './types';

// Formazione di comodo: P in zona1 (indice0), poi a seguire secondo il giro.
const ROTAZIONE = ['p', 'x1', 'x2', 'o', 'x3', 'x4'];

function giocatore(id: string, ruolo: Player['ruolo']): Player {
  return { id, teamId: 't', numero: 1, nome: id, ruolo, attivo: true };
}

describe('indiciCentrali', () => {
  it('con giro schiacciatore-centrale, i centrali sono 2 zone dopo ogni schiacciatore', () => {
    // Sequenza: P(0) S(1) C(2) O(3) S(4) C(5) -> centrali a indice 2 e 5 (zona 3 e 6)
    expect(indiciCentrali(ROTAZIONE, 'p', 'schiacciatore-centrale')).toEqual([2, 5]);
  });

  it('con giro centrale-schiacciatore, i centrali sono subito dopo il palleggiatore e dopo l opposto', () => {
    // Sequenza: P(0) C(1) S(2) O(3) C(4) S(5) -> centrali a indice 1 e 4 (zona 2 e 5)
    expect(indiciCentrali(ROTAZIONE, 'p', 'centrale-schiacciatore')).toEqual([1, 4]);
  });

  it('segue il palleggiatore quando ruota e non resta fisso sulla zona1', () => {
    // Palleggiatore ruotato in zona2 (indice1): la sequenza si sposta di conseguenza.
    const ruotata = ['x4', 'p', 'x1', 'x2', 'o', 'x3'];
    expect(indiciCentrali(ruotata, 'p', 'schiacciatore-centrale')).toEqual([3, 0]);
  });

  it('ritorna array vuoto se il palleggiatore non e in rotazione', () => {
    expect(indiciCentrali(ROTAZIONE, 'assente', 'schiacciatore-centrale')).toEqual([]);
  });
});

describe('liberoDaUsarePerCambioAutomatico', () => {
  it('usa il primo libero scelto per la partita quando ce ne sono piu di 2 in rosa', () => {
    const roster = [giocatore('l1', 'libero'), giocatore('l2', 'libero'), giocatore('l3', 'libero')];
    expect(liberoDaUsarePerCambioAutomatico(['l2', 'l3'], roster)).toBe('l2');
  });

  it('usa l unico libero in rosa quando non serve una scelta esplicita', () => {
    const roster = [giocatore('l1', 'libero'), giocatore('s1', 'schiacciatore')];
    expect(liberoDaUsarePerCambioAutomatico(null, roster)).toBe('l1');
  });

  it('ritorna null se ci sono piu liberi senza una scelta esplicita', () => {
    const roster = [giocatore('l1', 'libero'), giocatore('l2', 'libero')];
    expect(liberoDaUsarePerCambioAutomatico(null, roster)).toBeNull();
  });

  it('ritorna null se non ci sono liberi in rosa', () => {
    expect(liberoDaUsarePerCambioAutomatico(null, [giocatore('s1', 'schiacciatore')])).toBeNull();
  });
});

describe('rotazioneConCambioAutomatico', () => {
  it('sostituisce il centrale col libero solo in zona 5 o 6, mai in zona 1', () => {
    // Centrali a indice 2 (zona3, a rete) e 5 (zona6, seconda linea): solo il secondo va sostituito.
    const risultato = rotazioneConCambioAutomatico(ROTAZIONE, 'p', 'schiacciatore-centrale', 'lib');
    expect(risultato).toEqual(['p', 'x1', 'x2', 'o', 'x3', 'lib']);
  });

  it('col giro centrale-schiacciatore sostituisce solo il centrale di seconda linea', () => {
    // Centrali a indice 1 (zona2, a rete) e 4 (zona5, seconda linea) col giro centrale-schiacciatore.
    const risultato = rotazioneConCambioAutomatico(ROTAZIONE, 'p', 'centrale-schiacciatore', 'lib');
    expect(risultato).toEqual(['p', 'x1', 'x2', 'o', 'lib', 'x4']);
  });

  it('non sostituisce mai il centrale quando la rotazione lo porta in zona 1 (deve poter battere)', () => {
    // Palleggiatore in zona5 (indice4): coi centrali a offset 2 e 5, uno
    // finisce esattamente in zona1 (indice0) e non va sostituito, l'altro
    // in zona4 (indice3, a rete) e non va sostituito comunque.
    const rotazionePalleggiatoreZona5 = ['a', 'b', 'c', 'd', 'p', 'e'];
    const risultato = rotazioneConCambioAutomatico(rotazionePalleggiatoreZona5, 'p', 'schiacciatore-centrale', 'lib');
    expect(risultato).toEqual(rotazionePalleggiatoreZona5);
  });

  it('non modifica nulla se manca palleggiatore, giro o libero', () => {
    expect(rotazioneConCambioAutomatico(ROTAZIONE, null, 'schiacciatore-centrale', 'lib')).toEqual(ROTAZIONE);
    expect(rotazioneConCambioAutomatico(ROTAZIONE, 'p', null, 'lib')).toEqual(ROTAZIONE);
    expect(rotazioneConCambioAutomatico(ROTAZIONE, 'p', 'schiacciatore-centrale', null)).toEqual(ROTAZIONE);
  });

  it('nessuna sostituzione quando, dopo la rotazione, entrambi i centrali sono a rete o al servizio', () => {
    const ruotata = ['x4', 'p', 'x1', 'x2', 'o', 'x3'];
    const risultato = rotazioneConCambioAutomatico(ruotata, 'p', 'schiacciatore-centrale', 'lib');
    // Centrali a indice 3 (zona4, a rete) e 0 (zona1, al servizio): nessuno va sostituito.
    expect(risultato).toEqual(ruotata);
  });
});
