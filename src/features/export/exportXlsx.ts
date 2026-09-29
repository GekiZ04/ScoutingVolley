import ExcelJS from 'exceljs';
import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaRigaGiocatore } from '@/domain/statisticheComplete';
import { frecceAttacco, frecceBattuta, puntoIncrocioRete, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import { GRUPPI_TABELLINO as GRUPPI, valoriRigaTabellino as valoriRiga } from './tabellinoColonne';
import type { Azione, Player, Squadra } from '@/domain/types';

const COLORE_INTESTAZIONE = 'FF1E3A5F';
const COLORE_SOTTOINTESTAZIONE = 'FFE2E8F0';

function costruisciFoglioSquadra(workbook: ExcelJS.Workbook, nomeSquadra: string, giocatori: Player[], azioni: Parameters<typeof calcolaRigaGiocatore>[0]) {
  const sheet = workbook.addWorksheet(nomeSquadra.slice(0, 31) || 'Squadra');

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 18;
  let colonna = 3;
  for (const gruppo of GRUPPI) {
    const inizio = colonna;
    const fine = colonna + gruppo.colonne.length - 1;
    sheet.mergeCells(1, inizio, 1, fine);
    const celleTitolo = sheet.getCell(1, inizio);
    celleTitolo.value = gruppo.titolo;
    celleTitolo.alignment = { horizontal: 'center' };
    celleTitolo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celleTitolo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_INTESTAZIONE } };
    for (let i = 0; i < gruppo.colonne.length; i += 1) {
      const cella = sheet.getCell(2, inizio + i);
      cella.value = gruppo.colonne[i];
      cella.font = { bold: true };
      cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_SOTTOINTESTAZIONE } };
      cella.alignment = { horizontal: 'center' };
      sheet.getColumn(inizio + i).width = 7;
    }
    colonna = fine + 1;
  }
  sheet.getCell(1, 1).value = '#';
  sheet.getCell(1, 2).value = 'Giocatore';
  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 2, 2, 2);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 18;

  let rigaIndice = 3;
  for (const giocatore of giocatori) {
    const riga = calcolaRigaGiocatore(azioni, giocatore.id);
    sheet.getCell(rigaIndice, 1).value = giocatore.numero;
    sheet.getCell(rigaIndice, 2).value = giocatore.nome;
    const valori = valoriRiga(riga);
    valori.forEach((v, i) => {
      sheet.getCell(rigaIndice, 3 + i).value = v;
    });
    rigaIndice += 1;
  }

  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];
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
  const { match, giocatori, riepiloghi, tutteLeAzioni } = await caricaRiepilogoPartita(matchId);

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

  const giocatoriA = giocatori.filter((g) => g.teamId === match.squadraAId);
  const giocatoriB = giocatori.filter((g) => g.teamId === match.squadraBId);
  costruisciFoglioSquadra(workbook, 'Squadra A', giocatoriA, tutteLeAzioni);
  costruisciFoglioSquadra(workbook, 'Squadra B', giocatoriB, tutteLeAzioni);
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
