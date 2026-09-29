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

    // Riga 1 = intestazioni di gruppo, riga 2 = sotto-colonne, riga 3 = Verdi.
    expect(foglioA!.getCell(1, 3).value).toBe('Battuta');
    expect(foglioA!.getCell(3, 2).value).toBe('Verdi');

    // Colonne 3-6 Battuta, 7-9 Direzioni battuta, 10-13 Ricezione,
    // 14-19 Attacco (Tot,Err,Mur,Pt,Pt%,Eff%), 20-23 Attacco dopo Ric.POS,
    // 24-27 Attacco dopo Ric.NEG, 28-33 Contrattacco.
    expect(foglioA!.getCell(1, 7).value).toBe('Direzioni battuta');
    expect(foglioA!.getCell(3, 9).value).toBe(100); // battuta fascia centro->centro: Centro% 100
    expect(foglioA!.getCell(3, 7).value).toBe(0); // Par% 0
    expect(foglioA!.getCell(1, 14).value).toBe('Attacco');
    expect(foglioA!.getCell(2, 14).value).toBe('Tot');
    expect(foglioA!.getCell(3, 14).value).toBe(1); // Attacco Tot
    expect(foglioA!.getCell(3, 17).value).toBe(1); // Attacco Pt
    expect(foglioA!.getCell(1, 28).value).toBe('Contrattacco');
    expect(foglioA!.getCell(3, 28).value).toBe(1); // Contrattacco Tot
    expect(foglioA!.getCell(3, 29).value).toBe(1); // Contrattacco Err

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
