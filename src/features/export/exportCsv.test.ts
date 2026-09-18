import { describe, it, expect, vi } from 'vitest';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from './exportCsv';

describe('exportCsv', () => {
  async function creaScenarioBase() {
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
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
      origine: { x: 8, y: 83 }, destinazione: { x: 92, y: 17 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    return { match, giocatoreA1 };
  }

  it('genera il csv delle azioni con una riga per azione', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvAzioni(match.id);
    const righe = csv.split('\n');
    expect(righe[0]).toBe(
      'data,set,rally,squadra,giocatore,fondamentale,tipoBattuta,valutazione,origine_x,origine_y,destinazione_x,destinazione_y,toccoMuro,timestamp',
    );
    expect(righe[1]).toContain(`#1 ${giocatoreA1.nome}`);
    expect(righe[1]).toContain('battuta');
    expect(righe[1]).toContain('8,83,92,17,no');
    expect(righe).toHaveLength(2);
  });

  it('genera il csv del box score con tentativi ed efficienza per fondamentale', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvBoxScore(match.id);
    const righe = csv.split('\n');
    const rigaGiocatore = righe.find((r) => r.startsWith(`#1 ${giocatoreA1.nome}`));
    expect(rigaGiocatore).toContain('1,100.0');
  });

  it('scaricaCsv crea e scarica un blob con il nome file indicato', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    scaricaCsv('partita.csv', 'a,b,c');

    expect(createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    // revokeObjectURL è differita con setTimeout per non rimuovere l'URL
    // dell'anchor prima che il download parta (rilevante su iPadOS Safari).
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    appendSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('scaricaCsv antepone il BOM UTF-8 al contenuto per una corretta visualizzazione in Excel', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    scaricaCsv('partita.csv', 'à,è,ò');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const bytes = new Uint8Array(buffer);
    // BOM UTF-8 = EF BB BF
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const testoSenzaBom = new TextDecoder('utf-8').decode(bytes.slice(3));
    expect(testoSenzaBom).toContain('à,è,ò');

    await new Promise((resolve) => setTimeout(resolve, 0));
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
