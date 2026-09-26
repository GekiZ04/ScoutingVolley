import { describe, it, expect, vi } from 'vitest';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaPdfReport, scaricaPdf } from './exportPdf';

describe('exportPdf', () => {
  it('genera un blob PDF non vuoto con il punteggio e il box score della partita', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
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
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');

    const blob = await generaPdfReport(match.id);

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('disegna il diagramma delle direzioni attacco per entrambe le squadre', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 3, nome: 'Verdi', ruolo: 'schiacciatore' });
    const giocatoreB1 = await aggiungiGiocatore({ teamId: squadraB.id, numero: 4, nome: 'Rizzo', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: [giocatoreB1.id, 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
      origine: { x: 30, y: 20 }, destinazione: { x: 70, y: 80 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await salvaAzione({
      id: 'az2', rallyId: 'r1', setId: set.id, ordine: 2, squadra: 'B', giocatoreId: giocatoreB1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '=',
      origine: { x: 60, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:01.000Z',
    });

    const blob = await generaPdfReport(match.id);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const testo = new TextDecoder('latin1').decode(buffer);

    expect(testo).toContain('Direzioni attacco');
    expect(testo).toContain('Squadra A');
    expect(testo).toContain('Squadra B');
    expect(testo).toContain('Punto');
    expect(testo).toContain('Errore');
    expect(testo).toContain('Difeso');
  });

  it('scaricaPdf crea e scarica un blob con il nome file indicato', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    scaricaPdf('partita.pdf', new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    appendSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
