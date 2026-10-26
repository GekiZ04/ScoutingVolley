import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaXlsxReport, scaricaXlsx } from './exportXlsx';

describe('exportXlsx', () => {
  it('genera un workbook con un foglio per squadra e le colonne attacco/contrattacco separate', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Verdi', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    // Primo attacco del rally (dopo ricezione, non salvata qui): resta "attacco".
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
      origine: { x: 30, y: 50 }, destinazione: { x: 70, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    // Secondo attacco dello stesso rally, stesso giocatore: e' un contrattacco.
    await salvaAzione({
      id: 'az2', rallyId: 'r1', setId: set.id, ordine: 2, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '=',
      origine: { x: 30, y: 50 }, destinazione: { x: 70, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:01.000Z',
    });
    // Battuta con traiettoria nota (fascia centro->centro), per verificare che
    // le direzioni di battuta restino separate da quelle di attacco.
    await salvaRally({ id: 'r0', setId: set.id, numero: 0, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az0', rallyId: 'r0', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '+',
      origine: { x: 5, y: 50 }, destinazione: { x: 95, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T09:59:00.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');

    const blob = await generaXlsxReport(match.id);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(0);

    // jsdom non implementa Blob.prototype.arrayBuffer in modo affidabile:
    // si legge via FileReader, come gia' fatto altrove nei test di export.
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.getWorksheet('Riepilogo')).toBeDefined();
    const foglioA = workbook.getWorksheet('Squadra A');
    expect(foglioA).toBeDefined();

    // Riga 1 = intestazioni di gruppo, riga 2 = sotto-colonne, riga 3 = titolo
    // PARTITA INTERA, riga 4 = Verdi, riga 5 = totale squadra. Colonne 1-5 Set,
    // 6 #, 7 Giocatore.
    expect(foglioA!.getCell(3, 1).value).toBe('PARTITA INTERA');
    expect(foglioA!.getCell(1, 8).value).toBe('Punti');
    expect(foglioA!.getCell(2, 10).value).toBe('V-P');
    expect(foglioA!.getCell(1, 11).value).toBe('Battuta');
    expect(foglioA!.getCell(4, 7).value).toBe('Verdi');

    // Colonne 8-10 Punti, 11-14 Battuta, 15-18 Ricezione,
    // 19-24 Attacco (Tot,Err,Mur,Pt,Pt%,Eff%), 25-28 Attacco dopo Ric.POS,
    // 29-32 Attacco dopo Ric.NEG, 33-38 Contrattacco. Le direzioni di battuta
    // non sono nel tabellino.
    expect(foglioA!.getCell(1, 15).value).toBe('Ricezione');
    expect(foglioA!.getCell(1, 19).value).toBe('Attacco');
    expect(foglioA!.getCell(2, 19).value).toBe('Tot');
    expect(foglioA!.getCell(4, 19).value).toBe(2); // Attacco Tot: attacco + contrattacco
    expect(foglioA!.getCell(4, 20).value).toBe(1); // Attacco Err (quello del contrattacco)
    expect(foglioA!.getCell(4, 22).value).toBe(1); // Attacco Pt
    expect(foglioA!.getCell(1, 33).value).toBe('Contrattacco');
    expect(foglioA!.getCell(4, 33).value).toBe(1); // Contrattacco Tot
    expect(foglioA!.getCell(4, 34).value).toBe(1); // Contrattacco Err

    // Ultima riga: totale squadra, calcolato su tutte le azioni della squadra A.
    expect(foglioA!.getCell(5, 7).value).toBe('Totale squadra');
    expect(foglioA!.getCell(5, 11).value).toBe(1); // Battuta Tot
    expect(foglioA!.getCell(5, 19).value).toBe(2); // Attacco Tot
    expect(foglioA!.getCell(5, 33).value).toBe(1); // Contrattacco Tot
    expect(foglioA!.getCell(5, 34).value).toBe(1); // Contrattacco Err
    const foglioB = workbook.getWorksheet('Squadra B');
    expect(foglioB!.getCell(4, 7).value).toBe('Totale squadra');
    expect(foglioB!.getCell(4, 11).value).toBe(0);

    // 2 campi per squadra + 1 per Verdi (unico giocatore reale con traiettoria
    // nota: gli altri id di formazione, 'a2'..'b6', non sono giocatori veri).
    const foglioDirezioni = workbook.getWorksheet('Direzioni attacco');
    expect(foglioDirezioni).toBeDefined();
    expect(foglioDirezioni!.getImages().length).toBe(3);
    expect(foglioDirezioni!.getCell(30, 1).value).toBe('Per giocatore');
    expect(foglioDirezioni!.getCell(31, 1).value).toBe('#3 Verdi');

    const foglioDirezioniBattuta = workbook.getWorksheet('Direzioni battuta');
    expect(foglioDirezioniBattuta).toBeDefined();
    expect(foglioDirezioniBattuta!.getImages().length).toBe(3);
  });

  it('nel foglio di ogni squadra ci sono la partita intera e un blocco per ogni set, ciascuno col suo totale', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const verdi = await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Verdi', ruolo: 'schiacciatore' });
    const bianchi = await aggiungiGiocatore({ teamId: squadraA.id, numero: 5, nome: 'Bianchi', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-10-09', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const battuta = (id: string, setId: string, giocatoreId: string, valutazione: '#' | '+') => ({
      id, rallyId: `r-${id}`, setId, ordine: 1, squadra: 'A' as const, giocatoreId,
      fondamentale: 'battuta' as const, tipoBattuta: 'flottante' as const, valutazione,
      origine: null, destinazione: null, toccoMuro: false, timestamp: '2026-10-09T10:00:00.000Z',
    });
    for (const [numero, giocatore, valutazioni] of [
      [1, verdi, ['#', '+']],
      [2, bianchi, ['+', '+', '#']],
    ] as const) {
      const set = await creaSet({
        matchId: match.id, numero,
        formazioneInizialeA: [giocatore.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
        formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
        primaSquadraAlServizio: 'A',
      });
      for (const [i, valutazione] of valutazioni.entries()) {
        await salvaRally({ id: `r-s${numero}-${i}`, setId: set.id, numero: i + 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
        await salvaAzione({ ...battuta(`s${numero}-${i}`, set.id, giocatore.id, valutazione), rallyId: `r-s${numero}-${i}` });
      }
      await aggiornaStatoSet(set.id, 'concluso', 'A');
    }

    const blob = await generaXlsxReport(match.id);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const foglio = workbook.getWorksheet('Squadra A')!;

    const prima = (r: number) => String(foglio.getCell(r, 1).value ?? '');
    const nome = (r: number) => String(foglio.getCell(r, 7).value ?? '');
    // Partita intera: tutta la rosa (Bianchi, Verdi) + totale; poi SET 1 e SET 2.
    const titoli: [number, string][] = [];
    for (let r = 3; r <= foglio.rowCount; r += 1) {
      if (/^(PARTITA INTERA|SET \d)/.test(prima(r))) titoli.push([r, prima(r)]);
    }
    expect(titoli.map(([, t]) => t.replace(/ \(.*/, ''))).toEqual(['PARTITA INTERA', 'SET 1', 'SET 2']);

    const [intera, set1, set2] = titoli.map(([r]) => r);
    // Ogni blocco finisce con "Totale squadra" subito prima del titolo
    // successivo; l'ultimo e' seguito da una riga vuota e da Punti Vinti.
    const ultimoTotale = set2 + 2;
    expect(nome(set1 - 1)).toBe('Totale squadra');
    expect(nome(set2 - 1)).toBe('Totale squadra');
    expect(nome(ultimoTotale)).toBe('Totale squadra');
    expect(nome(ultimoTotale + 2)).toBe('Punti Vinti');

    // Partita intera: 2 giocatori; SET 1: solo Verdi; SET 2: solo Bianchi.
    expect(set1 - intera - 2).toBe(2);
    expect(set2 - set1 - 2).toBe(1);
    expect(nome(set1 + 1)).toBe('Verdi');
    expect(nome(set2 + 1)).toBe('Bianchi');

    // Totali (colonna 11 = battute): partita 5, set 1 = 2, set 2 = 3.
    expect(foglio.getCell(set1 - 1, 11).value).toBe(5);
    expect(foglio.getCell(set2 - 1, 11).value).toBe(2);
    expect(foglio.getCell(ultimoTotale, 11).value).toBe(3);

    // Bordi spessi: all'inizio di ogni fondamentale (col. 11 = Battuta Tot,
    // non dentro il gruppo), sopra ogni titolo di sezione e sotto ogni totale.
    expect(foglio.getCell(set1 + 1, 11).border?.left?.style).toBe('medium');
    expect(foglio.getCell(1, 11).border?.left?.style).toBe('medium');
    expect(foglio.getCell(set1 + 1, 12).border?.left).toBeUndefined();
    expect(foglio.getCell(set1 + 1, 6).border?.left?.style).toBe('medium');
    expect(foglio.getCell(set1, 20).border?.top?.style).toBe('medium');
    expect(foglio.getCell(set1 - 1, 20).border?.bottom?.style).toBe('medium');
  });

  it('come il tabellino in app: colonne Set con la posizione di partenza, L per i liberi, prima battuta e Punti Vinti', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const verdi = await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Verdi', ruolo: 'palleggiatore' });
    const gialli = await aggiungiGiocatore({ teamId: squadraA.id, numero: 9, nome: 'Gialli', ruolo: 'libero' });
    const match = await creaPartita({
      data: '2026-10-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const azione = (id: string, setId: string, ordine: number, giocatoreId: string, fondamentale: 'battuta' | 'ricezione' | 'attacco', valutazione: '#' | '+') => ({
      id, rallyId: `r-${setId}`, setId, ordine, squadra: 'A' as const, giocatoreId,
      fondamentale, tipoBattuta: fondamentale === 'battuta' ? ('flottante' as const) : null, valutazione,
      origine: null, destinazione: null, toccoMuro: false, timestamp: '2026-10-16T10:00:00.000Z',
    });

    // Set 1: batte prima A, Verdi palleggiatore in P1; Gialli riceve (entra) e Verdi chiude in attacco.
    const set1 = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [verdi.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A', paleggiatoreIdA: verdi.id,
    });
    await salvaRally({ id: `r-${set1.id}`, setId: set1.id, numero: 1, squadraAlServizio: 'B', esito: null, chiusuraManuale: false });
    await salvaAzione(azione('s1-1', set1.id, 1, gialli.id, 'ricezione', '+'));
    await salvaAzione(azione('s1-2', set1.id, 2, verdi.id, 'attacco', '#'));
    await aggiornaStatoSet(set1.id, 'concluso', 'A');

    // Set 2: batte prima B, Verdi in P2 non palleggiatore, ace di Verdi.
    const set2 = await creaSet({
      matchId: match.id, numero: 2,
      formazioneInizialeA: ['a1', verdi.id, 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'B',
    });
    await salvaRally({ id: `r-${set2.id}`, setId: set2.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione(azione('s2-1', set2.id, 1, verdi.id, 'battuta', '#'));
    await aggiornaStatoSet(set2.id, 'concluso', 'A');

    const blob = await generaXlsxReport(match.id);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const foglio = workbook.getWorksheet('Squadra A')!;

    // Intestazione Set: numero cerchiato dove la squadra ha battuto per prima.
    expect(foglio.getCell(1, 1).value).toBe('Set');
    expect([1, 2, 3, 4, 5].map((c) => foglio.getCell(2, c).value)).toEqual(['①', '2', '3', '4', '5']);
    expect(workbook.getWorksheet('Squadra B')!.getCell(2, 2).value).toBe('②');
    expect(foglio.getCell(1, 6).value).toBe('#');
    expect(foglio.getCell(1, 7).value).toBe('Giocatore');

    // Riga 4 = Verdi: P1 in grassetto (palleggiatore) nel set 1, P2 nel set 2.
    expect(foglio.getCell(4, 7).value).toBe('Verdi');
    expect(foglio.getCell(4, 1).value).toBe(1);
    expect(foglio.getCell(4, 1).font?.bold).toBe(true);
    expect(foglio.getCell(4, 1).border?.top?.style).toBe('thin');
    expect(foglio.getCell(4, 2).value).toBe(2);
    expect(foglio.getCell(4, 2).font?.bold).toBeFalsy();
    expect(foglio.getCell(4, 3).border?.top).toBeUndefined();

    // Riga 5 = Gialli: libero con "L", entrato nel set 1 (quadratino vuoto), assente nel set 2.
    const nomeGialli = foglio.getCell(5, 7).value as ExcelJS.CellRichTextValue;
    expect(nomeGialli.richText.map((t) => t.text).join('')).toBe('Gialli L');
    expect(nomeGialli.richText[nomeGialli.richText.length - 1].font?.bold).toBe(true);
    expect(foglio.getCell(5, 1).value).toBeNull();
    expect(foglio.getCell(5, 1).border?.top?.style).toBe('thin');
    expect(foglio.getCell(5, 2).border?.top).toBeUndefined();

    // Punti Vinti: Batt/Err batt/Att/Err att/Mur/Er.Av per set e totale (qui nessun errore).
    let riga = 1;
    while (foglio.getCell(riga, 7).value !== 'Punti Vinti') riga += 1;
    expect([8, 9, 10, 11, 12, 13].map((c) => foglio.getCell(riga, c).value)).toEqual([
      'Batt', 'Err batt', 'Att', 'Err att', 'Mur', 'Er.Av',
    ]);
    const puntiVinti = [1, 2, 3].map((i) => [7, 8, 9, 10, 11, 12, 13].map((c) => foglio.getCell(riga + i, c).value));
    expect(puntiVinti).toEqual([
      ['Set 1', 0, 0, 1, 0, 0, 0],
      ['Set 2', 1, 0, 0, 0, 0, 0],
      ['Totale', 1, 0, 1, 0, 0, 0],
    ]);
  });

  it('genera senza errori il workbook anche con un attacco toccato dal muro (linea spezzata)', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Verdi', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '/',
      origine: { x: 30, y: 20 }, destinazione: { x: 52, y: 40 }, toccoMuro: true,
      timestamp: '2026-09-16T10:00:00.000Z',
    });

    const blob = await generaXlsxReport(match.id);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('scaricaXlsx crea e scarica un blob con il nome file indicato', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    scaricaXlsx('partita.xlsx', new Blob(['pk'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
