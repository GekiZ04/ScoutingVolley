import ExcelJS from 'exceljs';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { frecceAttacco, frecceBattuta, puntoIncrocioRete, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import { extraTabellinoSquadra, NUMERI_SET } from '@/features/tabellino/righeTabellino';
import { GRUPPI_TABELLINO as GRUPPI, sezioniTabellino } from './tabellinoColonne';
import type { Azione, Player, Squadra } from '@/domain/types';

const COLORE_INTESTAZIONE = 'FF1E3A5F';
const COLORE_SOTTOINTESTAZIONE = 'FFE2E8F0';
const COLORE_TITOLO_SEZIONE = 'FF475569';

// Cifre cerchiate per il numero del set in cui la squadra ha battuto per prima:
// exceljs non disegna forme, il cerchio del tabellino in app diventa un carattere.
const SET_CERCHIATO = ['①', '②', '③', '④', '⑤'];
const BORDO_QUADRATINO: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

// Colonne come nel tabellino in app: Set 1-5 (posizione di partenza in un
// quadratino, grassetto per il palleggiatore, quadratino vuoto se entrato),
// #, Giocatore (con "L" per i liberi) e i gruppi di fondamentali; sotto, la
// tabella Punti Vinti per set.
function costruisciFoglioSquadra(
  workbook: ExcelJS.Workbook,
  nomeSquadra: string,
  squadra: Squadra,
  dati: RiepilogoPartita,
) {
  const sheet = workbook.addWorksheet(nomeSquadra.slice(0, 31) || 'Squadra');
  const extra = extraTabellinoSquadra(dati, squadra);
  const sets = dati.riepiloghi.map(({ set, punteggioA, punteggioB }) => ({
    id: set.id,
    numero: set.numero,
    punteggioA,
    punteggioB,
  }));
  const colonneSet = NUMERI_SET.length;
  const colonnaNumero = colonneSet + 1;
  const colonnaGiocatore = colonneSet + 2;
  const primaColonnaValori = colonneSet + 3;

  const intestazione = (cella: ExcelJS.Cell, testo: string) => {
    cella.value = testo;
    cella.alignment = { horizontal: 'center' };
    cella.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_INTESTAZIONE } };
  };
  const sottointestazione = (cella: ExcelJS.Cell, testo: string) => {
    cella.value = testo;
    cella.font = { bold: true };
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_SOTTOINTESTAZIONE } };
    cella.alignment = { horizontal: 'center' };
  };

  sheet.mergeCells(1, 1, 1, colonneSet);
  intestazione(sheet.getCell(1, 1), 'Set');
  NUMERI_SET.forEach((n, i) => {
    sottointestazione(sheet.getCell(2, 1 + i), extra.primaBattuta[i] ? SET_CERCHIATO[i] : String(n));
    sheet.getColumn(1 + i).width = 4;
  });
  sheet.getColumn(colonnaNumero).width = 6;
  sheet.getColumn(colonnaGiocatore).width = 18;
  let colonna = primaColonnaValori;
  for (const gruppo of GRUPPI) {
    const inizio = colonna;
    const fine = colonna + gruppo.colonne.length - 1;
    sheet.mergeCells(1, inizio, 1, fine);
    intestazione(sheet.getCell(1, inizio), gruppo.titolo);
    for (let i = 0; i < gruppo.colonne.length; i += 1) {
      sottointestazione(sheet.getCell(2, inizio + i), gruppo.colonne[i]);
      sheet.getColumn(inizio + i).width = 7;
    }
    colonna = fine + 1;
  }
  sheet.getCell(1, colonnaNumero).value = '#';
  sheet.getCell(1, colonnaGiocatore).value = 'Giocatore';
  sheet.mergeCells(1, colonnaNumero, 2, colonnaNumero);
  sheet.mergeCells(1, colonnaGiocatore, 2, colonnaGiocatore);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 18;

  const colonneTotali = colonneSet + 2 + GRUPPI.reduce((n, g) => n + g.colonne.length, 0);
  const riempi = (riga: number, argb: string) => {
    for (let c = 1; c <= colonneTotali; c += 1) {
      sheet.getCell(riga, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
  };

  // Partita intera e poi un blocco per ogni set: titolo, righe giocatore,
  // totale squadra del blocco.
  let rigaIndice = 3;
  for (const sezione of sezioniTabellino({ giocatori: extra.roster, squadra, azioni: dati.tutteLeAzioni, rallies: dati.tutteLeRallies, sets })) {
    sheet.mergeCells(rigaIndice, 1, rigaIndice, colonnaGiocatore);
    sheet.getCell(rigaIndice, 1).value = sezione.titolo;
    riempi(rigaIndice, COLORE_TITOLO_SEZIONE);
    sheet.getRow(rigaIndice).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rigaIndice += 1;

    for (const riga of sezione.righe) {
      extra.celleSet(riga.giocatore).forEach((cellaSet, i) => {
        if (!cellaSet || i >= colonneSet) return;
        const cella = sheet.getCell(rigaIndice, 1 + i);
        cella.border = BORDO_QUADRATINO;
        cella.alignment = { horizontal: 'center' };
        if (cellaSet.tipo === 'titolare') {
          cella.value = cellaSet.posizione;
          if (cellaSet.palleggiatore) cella.font = { bold: true };
        }
      });
      sheet.getCell(rigaIndice, colonnaNumero).value = riga.numero;
      sheet.getCell(rigaIndice, colonnaGiocatore).value = extra.libero(riga.giocatore)
        ? { richText: [{ text: `${riga.nome} ` }, { text: 'L', font: { bold: true } }] }
        : riga.nome;
      riga.valori.forEach((v, i) => {
        sheet.getCell(rigaIndice, primaColonnaValori + i).value = v;
      });
      rigaIndice += 1;
    }

    sheet.getCell(rigaIndice, colonnaGiocatore).value = 'Totale squadra';
    sezione.totale.forEach((v, i) => {
      sheet.getCell(rigaIndice, primaColonnaValori + i).value = v;
    });
    riempi(rigaIndice, COLORE_SOTTOINTESTAZIONE);
    sheet.getRow(rigaIndice).font = { bold: true };
    rigaIndice += 1;
  }

  // Punti Vinti per set, una riga vuota sotto l'ultimo totale: etichetta nella
  // colonna Giocatore, Batt/Att/Mur/Er.Av nelle colonne successive.
  rigaIndice += 1;
  ['Punti Vinti', 'Batt', 'Att', 'Mur', 'Er.Av'].forEach((testo, i) => {
    sottointestazione(sheet.getCell(rigaIndice, colonnaGiocatore + i), testo);
  });
  sheet.getCell(rigaIndice, colonnaGiocatore).alignment = { horizontal: 'left' };
  rigaIndice += 1;
  for (const { etichetta, valori } of extra.puntiVinti) {
    [etichetta, valori.batt, valori.att, valori.mur, valori.erAv].forEach((v, i) => {
      sheet.getCell(rigaIndice, colonnaGiocatore + i).value = v;
    });
    rigaIndice += 1;
  }

  sheet.views = [{ state: 'frozen', xSplit: colonnaGiocatore, ySplit: 2 }];
  return sheet;
}

const COLORE_ESITO_ATTACCO: Record<EsitoAttacco, string> = {
  punto: '#000000',
  errore: '#ef4444',
  difeso: '#2563eb',
};

// Rendering via canvas offscreen: exceljs non sa disegnare forme vettoriali
// (linee, triangoli) nel foglio, solo immagini raster. Il campo ha lo stesso
// rapporto 2:1 del campo reale (18x9m) e le stesse coordinate di dominio
// (0-100 su entrambi gli assi) usate ovunque nell'app.
function disegnaCampoConFrecceCanvas(frecce: FrecciaAttacco[]): string {
  const larghezzaPx = 480;
  const altezzaPx = 240;
  const canvas = document.createElement('canvas');
  canvas.width = larghezzaPx;
  canvas.height = altezzaPx;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#155e75';
  ctx.fillRect(0, 0, larghezzaPx, altezzaPx);

  const px = (domX: number) => (domX / 100) * larghezzaPx;
  const py = (domY: number) => (domY / 100) * altezzaPx;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, larghezzaPx - 2, altezzaPx - 2);
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(px(LINEA_TRE_METRI_A), 0);
  ctx.lineTo(px(LINEA_TRE_METRI_A), altezzaPx);
  ctx.moveTo(px(LINEA_TRE_METRI_B), 0);
  ctx.lineTo(px(LINEA_TRE_METRI_B), altezzaPx);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px(RETE_X), 0);
  ctx.lineTo(px(RETE_X), altezzaPx);
  ctx.stroke();

  const lunghezzaFreccia = 9;
  const larghezzaFreccia = 4.5;
  for (const freccia of frecce) {
    const colore = COLORE_ESITO_ATTACCO[freccia.esito];
    const x1 = px(freccia.origine.x);
    const y1 = py(freccia.origine.y);
    const x2 = px(freccia.destinazione.x);
    const y2 = py(freccia.destinazione.y);

    ctx.strokeStyle = colore;
    ctx.fillStyle = colore;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    // Toccata dal muro: linea spezzata origine->rete->destinazione (con un
    // pallino sul punto di tocco) invece che dritta, cosi' si vede la
    // deviazione senza dover registrare un terzo punto a parte.
    if (freccia.toccoMuro) {
      const tocco = puntoIncrocioRete(freccia.origine, freccia.destinazione);
      const xt = px(tocco.x);
      const yt = py(tocco.y);
      ctx.lineTo(xt, yt);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(xt, yt, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const angolo = Math.atan2(y2 - y1, x2 - x1);
    const baseX = x2 - lunghezzaFreccia * Math.cos(angolo);
    const baseY = y2 - lunghezzaFreccia * Math.sin(angolo);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(baseX + larghezzaFreccia * Math.cos(angolo + Math.PI / 2), baseY + larghezzaFreccia * Math.sin(angolo + Math.PI / 2));
    ctx.lineTo(baseX + larghezzaFreccia * Math.cos(angolo - Math.PI / 2), baseY + larghezzaFreccia * Math.sin(angolo - Math.PI / 2));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/png').split(',')[1];
}

function aggiungiFoglioDirezioni(
  workbook: ExcelJS.Workbook,
  nomeFoglio: string,
  sottotitolo: string,
  azioni: Azione[],
  giocatori: Player[],
  frecceFn: (azioni: Azione[], squadra?: Squadra, giocatoreId?: string) => FrecciaAttacco[],
) {
  const sheet = workbook.addWorksheet(nomeFoglio);
  sheet.getCell(1, 1).value = sottotitolo;
  sheet.getCell(1, 1).font = { bold: true };

  const squadre: [Squadra, string][] = [
    ['A', 'Squadra A'],
    ['B', 'Squadra B'],
  ];
  let riga = 2;
  for (const [squadra, etichetta] of squadre) {
    sheet.getCell(riga, 1).value = etichetta;
    sheet.getCell(riga, 1).font = { bold: true };
    const base64 = disegnaCampoConFrecceCanvas(frecceFn(azioni, squadra));
    const imageId = workbook.addImage({ base64, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0, row: riga }, ext: { width: 480, height: 240 } });
    riga += 14;
  }

  // Un piccolo campo per ogni giocatore con almeno una traiettoria nota,
  // elenco unico come nel foglio squadra (non diviso per squadra).
  const giocatoriConDati = giocatori.filter((g) => frecceFn(azioni, undefined, g.id).length > 0);
  if (giocatoriConDati.length > 0) {
    sheet.getCell(riga, 1).value = 'Per giocatore';
    sheet.getCell(riga, 1).font = { bold: true };
    riga += 1;
    for (const giocatore of giocatoriConDati) {
      sheet.getCell(riga, 1).value = `#${giocatore.numero} ${giocatore.nome}`;
      const base64 = disegnaCampoConFrecceCanvas(frecceFn(azioni, undefined, giocatore.id));
      const imageId = workbook.addImage({ base64, extension: 'png' });
      sheet.addImage(imageId, { tl: { col: 0, row: riga }, ext: { width: 240, height: 120 } });
      riga += 7;
    }
  }
}

export async function generaXlsxReport(matchId: string): Promise<Blob> {
  const dati = await caricaRiepilogoPartita(matchId);
  const { match, giocatori, riepiloghi, tutteLeAzioni } = dati;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Scouting Pallavolo';
  workbook.created = new Date();

  const riepilogo = workbook.addWorksheet('Riepilogo');
  riepilogo.getColumn(1).width = 14;
  riepilogo.getColumn(2).width = 10;
  riepilogo.getCell(1, 1).value = `Report partita — ${match.data}`;
  riepilogo.getCell(1, 1).font = { bold: true, size: 14 };
  riepilogo.getCell(2, 1).value = 'Set';
  riepilogo.getCell(2, 2).value = 'Punteggio';
  riepilogo.getRow(2).font = { bold: true };
  riepiloghi.forEach(({ set, punteggioA, punteggioB }, indice) => {
    riepilogo.getCell(3 + indice, 1).value = `Set ${set.numero}`;
    riepilogo.getCell(3 + indice, 2).value = `${punteggioA} - ${punteggioB}`;
  });

  costruisciFoglioSquadra(workbook, 'Squadra A', 'A', dati);
  costruisciFoglioSquadra(workbook, 'Squadra B', 'B', dati);
  aggiungiFoglioDirezioni(
    workbook, 'Direzioni attacco', 'Direzioni attacco — nero: punto, rosso: errore, blu: difeso',
    tutteLeAzioni, giocatori, frecceAttacco,
  );
  aggiungiFoglioDirezioni(
    workbook, 'Direzioni battuta', 'Direzioni battuta — nero: ace, rosso: errore, blu: ricevuta',
    tutteLeAzioni, giocatori, frecceBattuta,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function scaricaXlsx(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
