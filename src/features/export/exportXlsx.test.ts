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

    // Colonne 3-6 Battuta, 7-10 Ricezione, 11-16 Attacco (Tot,Err,Mur,Pt,Pt%,Eff%),
    // 17-20 Attacco dopo Ric.POS, 21-24 Attacco dopo Ric.NEG, 25-30 Contrattacco.
    expect(foglioA!.getCell(1, 11).value).toBe('Attacco');
    expect(foglioA!.getCell(2, 11).value).toBe('Tot');
    expect(foglioA!.getCell(3, 11).value).toBe(1); // Attacco Tot
    expect(foglioA!.getCell(3, 14).value).toBe(1); // Attacco Pt
    expect(foglioA!.getCell(1, 25).value).toBe('Contrattacco');
    expect(foglioA!.getCell(3, 25).value).toBe(1); // Contrattacco Tot
    expect(foglioA!.getCell(3, 26).value).toBe(1); // Contrattacco Err

    const foglioDirezioni = workbook.getWorksheet('Direzioni attacco');
    expect(foglioDirezioni).toBeDefined();
    expect(foglioDirezioni!.getImages().length).toBe(2); // un campo per squadra
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
