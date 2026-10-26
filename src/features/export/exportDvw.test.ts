import { describe, it, expect } from 'vitest';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione, salvaSostituzione, salvaTimeout } from '@/db/scouting';
import { generaDvw } from './exportDvw';

const FINE = String.fromCharCode(13, 10);

async function preparaPartita() {
  const rossi = await creaSquadra('Volley Rossi');
  const blu = await creaSquadra('Volley Blu');
  const a = [];
  for (let i = 1; i <= 7; i += 1) {
    a.push(await aggiungiGiocatore({ teamId: rossi.id, numero: i * 2, nome: `Rossa ${i}`, ruolo: i === 1 ? 'palleggiatore' : 'schiacciatore' }));
  }
  const b = [];
  for (let i = 1; i <= 6; i += 1) b.push(await aggiungiGiocatore({ teamId: blu.id, numero: i, nome: `Blu ${i}`, ruolo: 'centrale' }));
  const match = await creaPartita({
    data: '2026-10-25', squadraAId: rossi.id, squadraBId: blu.id,
    squadraRiferimentoId: rossi.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: a.slice(0, 6).map((g) => g.id), formazioneInizialeB: b.map((g) => g.id),
    primaSquadraAlServizio: 'A', paleggiatoreIdA: a[0].id, giroA: 'schiacciatore-centrale',
  });
  // Rally 1: battuta di A (n. 2, P1) ricevuta da B (n. 3), attacco vincente di A (n. 4) da zona 4.
  await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
  const ora = '2026-10-25T16:05:03.000Z';
  await salvaAzione({ id: 'b1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: a[0].id, fondamentale: 'battuta', tipoBattuta: 'salto_flottante', valutazione: '-', origine: { x: 2, y: 10 }, destinazione: { x: 90, y: 10 }, toccoMuro: false, timestamp: ora });
  await salvaAzione({ id: 'r1r', rallyId: 'r1', setId: set.id, ordine: 2, squadra: 'B', giocatoreId: b[2].id, fondamentale: 'ricezione', tipoBattuta: null, valutazione: '+', origine: null, destinazione: null, toccoMuro: false, timestamp: ora });
  await salvaAzione({ id: 'a1', rallyId: 'r1', setId: set.id, ordine: 3, squadra: 'A', giocatoreId: a[1].id, fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 90 }, toccoMuro: false, timestamp: '2026-10-25T16:05:09.000Z' });
  // Dopo il primo punto: cambio in A e timeout di B; rally 2 chiuso a mano per B.
  await salvaSostituzione({ id: 's1', setId: set.id, dopoRallyNumero: 1, squadra: 'A', giocatoreEsceId: a[3].id, giocatoreEntraId: a[6].id });
  await salvaTimeout({ id: 't1', setId: set.id, dopoRallyNumero: 1, squadra: 'B' });
  await salvaRally({ id: 'r2', setId: set.id, numero: 2, squadraAlServizio: 'A', esito: 'punto_B', chiusuraManuale: true });
  await aggiornaStatoSet(set.id, 'concluso', 'A');
  return { match, a, b };
}

describe('generaDvw', () => {
  it('ha tutte le sezioni del formato DataVolley', async () => {
    const { match } = await preparaPartita();
    const testo = await generaDvw(match.id);
    for (const sezione of ['[3DATAVOLLEYSCOUT]', '[3MATCH]', '[3TEAMS]', '[3SET]', '[3PLAYERS-H]', '[3PLAYERS-V]', '[3SCOUT]']) {
      expect(testo).toContain(sezione);
    }
    expect(testo).toContain('25/10/2026');
    expect(testo).toContain(';Volley Rossi;1;');
    expect(testo).toContain(';Volley Blu;0;');
    expect(testo.split('\r\n').length).toBeGreaterThan(10);
  });

  it('scout: formazione, battuta, ricezione, attacco con zone, punti, cambio, timeout e fine set nell ordine giusto', async () => {
    const { match } = await preparaPartita();
    const scout = (await generaDvw(match.id)).split('[3SCOUT]\r\n')[1].split('\r\n').filter(Boolean);
    const codici = scout.map((riga) => riga.split(';')[0]);
    expect(codici).toEqual([
      '*P02>LUp', '*z1>LUp',
      '*02SM-~~~51', 'a03RM+~~~51', '*04AH#~~~45', '*p01:00',
      '*c08:14', 'aT',
      'ap01:01',
      '**1set',
    ]);
  });

  it('ogni azione ha ora, set, posizione del palleggiatore e i sei giocatori in campo per squadra', async () => {
    const { match } = await preparaPartita();
    const scout = (await generaDvw(match.id)).split('[3SCOUT]\r\n')[1].split('\r\n');
    const battuta = scout.find((r) => r.startsWith('*02SM'))!.split(';');
    expect(battuta[7]).toMatch(/^\d\d\.05\.03$/);
    expect(battuta[8]).toBe('1');
    expect(battuta[9]).toBe('1');
    expect(battuta.slice(14, 20)).toEqual(['2', '4', '6', '8', '10', '12']);
    expect(battuta.slice(20, 26)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('giocatori con numero, posizione di partenza nel set e ruolo', async () => {
    const { match } = await preparaPartita();
    const testo = await generaDvw(match.id);
    const casa = testo.split('[3PLAYERS-H]\r\n')[1].split('[3PLAYERS-V]')[0].split('\r\n').filter(Boolean);
    expect(casa[0].split(';').slice(0, 4)).toEqual(['0', '2', '1', '1']);
    expect(casa[0]).toContain('Rossa 1');
    expect(casa[0].split(';')[14]).toBe('5');
    // Il n. 14 e' entrato a set in corso: asterisco al posto della posizione.
    expect(casa.find((r) => r.split(';')[1] === '14')!.split(';')[3]).toBe('*');
  });

  it('set: parziali, punteggio finale e durata', async () => {
    const { match } = await preparaPartita();
    const set = (await generaDvw(match.id)).split('[3SET]\r\n')[1].split('\r\n');
    expect(set[0].split(';').slice(0, 5)).toEqual(['True', '', '', '', '1-1']);
    expect(set[1].startsWith('False')).toBe(true);
  });

  it('due schede con lo stesso numero nella stessa squadra diventano una riga sola', async () => {
    const { match, b } = await preparaPartita();
    // Lo stesso giocatore inserito due volte in rosa (es. ricreato per un altra partita).
    await aggiungiGiocatore({ teamId: b[0].teamId, numero: 3, nome: 'Blu 3 bis', ruolo: 'centrale' });
    const testo = await generaDvw(match.id);
    const ospiti = testo.split('[3PLAYERS-V]' + FINE)[1].split('[3ATTACKCOMBINATION]')[0].split(FINE).filter(Boolean);
    const numero3 = ospiti.filter((r) => r.split(';')[1] === '3');
    expect(numero3).toHaveLength(1);
    expect(numero3[0]).toContain('Blu 3 / Blu 3 bis');
    expect(numero3[0].split(';')[3]).toBe('3');
    expect(ospiti.map((r) => r.split(';')[2])).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
