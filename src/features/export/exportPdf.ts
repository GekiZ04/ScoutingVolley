import { jsPDF } from 'jspdf';
import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaStatistiche, type FondamentaleStat } from '@/domain/stats';
import { frecceAttacco, frecceBattuta, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import type { Azione, Player, Squadra } from '@/domain/types';

const COLORE_ESITO_ATTACCO: Record<EsitoAttacco, [number, number, number]> = {
  punto: [0, 0, 0],
  errore: [239, 68, 68],
  difeso: [37, 99, 235],
};

// Disegna il campo (rapporto 2:1, come il campo reale 18x9m) con una freccia
// partenza->arrivo per ogni attacco, colorata secondo l'esito: nero = punto,
// rosso = errore, blu = difeso dall'avversario (rally continua).
function disegnaCampoConFrecce(
  doc: jsPDF,
  x: number,
  y: number,
  larghezza: number,
  altezza: number,
  frecce: FrecciaAttacco[],
): void {
  const px = (domX: number) => x + (domX / 100) * larghezza;
  const py = (domY: number) => y + (domY / 100) * altezza;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.rect(x, y, larghezza, altezza);
  doc.line(px(LINEA_TRE_METRI_A), y, px(LINEA_TRE_METRI_A), y + altezza);
  doc.line(px(LINEA_TRE_METRI_B), y, px(LINEA_TRE_METRI_B), y + altezza);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(px(RETE_X), y, px(RETE_X), y + altezza);

  const lunghezzaFreccia = 2.2;
  const larghezzaFreccia = 1.1;
  for (const freccia of frecce) {
    const [r, g, b] = COLORE_ESITO_ATTACCO[freccia.esito];
    doc.setDrawColor(r, g, b);
    doc.setFillColor(r, g, b);
    doc.setLineWidth(0.25);
    const x1 = px(freccia.origine.x);
    const y1 = py(freccia.origine.y);
    const x2 = px(freccia.destinazione.x);
    const y2 = py(freccia.destinazione.y);
    doc.line(x1, y1, x2, y2);

    const angolo = Math.atan2(y2 - y1, x2 - x1);
    const baseX = x2 - lunghezzaFreccia * Math.cos(angolo);
    const baseY = y2 - lunghezzaFreccia * Math.sin(angolo);
    const sinistraX = baseX + larghezzaFreccia * Math.cos(angolo + Math.PI / 2);
    const sinistraY = baseY + larghezzaFreccia * Math.sin(angolo + Math.PI / 2);
    const destraX = baseX + larghezzaFreccia * Math.cos(angolo - Math.PI / 2);
    const destraY = baseY + larghezzaFreccia * Math.sin(angolo - Math.PI / 2);
    doc.triangle(x2, y2, sinistraX, sinistraY, destraX, destraY, 'F');
  }
}

function disegnaLegendaFrecce(doc: jsPDF, x: number, y: number, etichettaDifeso: string = 'Difeso'): void {
  doc.setFontSize(9);
  const voci: [EsitoAttacco, string][] = [
    ['punto', 'Punto'],
    ['errore', 'Errore'],
    ['difeso', etichettaDifeso],
  ];
  let cursore = x;
  for (const [esito, etichetta] of voci) {
    const [r, g, b] = COLORE_ESITO_ATTACCO[esito];
    doc.setFillColor(r, g, b);
    doc.circle(cursore, y - 1, 1.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text(etichetta, cursore + 3, y);
    cursore += 25;
  }
}

// Griglia con un piccolo diagramma campo per giocatore (2 per riga), per chi
// ha almeno una traiettoria nota — stessa idea dei diagrammi per squadra ma
// a livello di singolo giocatore, elenco unico come in
// disegnaEfficienzaPerGiocatore (non diviso per squadra).
function disegnaGrigliaDirezioniGiocatori(
  doc: jsPDF,
  titolo: string,
  giocatori: Player[],
  azioni: Azione[],
  frecceFn: (azioni: Azione[], squadra?: Squadra, giocatoreId?: string) => FrecciaAttacco[],
  etichettaDifeso: string,
): void {
  const giocatoriConDati = giocatori.filter((g) => frecceFn(azioni, undefined, g.id).length > 0);
  if (giocatoriConDati.length === 0) return;

  doc.addPage();
  let y = 20;
  doc.setFontSize(16);
  doc.text(titolo, 14, y);
  y += 10;

  const larghezza = 85;
  const altezza = 42.5;
  const xColonne = [14, 14 + larghezza + 10];
  let colonna = 0;

  for (const giocatore of giocatoriConDati) {
    if (y + 6 + altezza + 6 > 280) {
      doc.addPage();
      y = 20;
      colonna = 0;
    }
    const x = xColonne[colonna];
    doc.setFontSize(10);
    doc.text(`#${giocatore.numero} ${giocatore.nome}`, x, y);
    disegnaCampoConFrecce(doc, x, y + 3, larghezza, altezza, frecceFn(azioni, undefined, giocatore.id));
    if (colonna === 1) {
      y += altezza + 12;
      colonna = 0;
    } else {
      colonna = 1;
    }
  }
  if (colonna === 1) y += altezza + 12;
  disegnaLegendaFrecce(doc, 14, y + 6, etichettaDifeso);
}

function disegnaEfficienzaPerGiocatore(
  doc: jsPDF,
  titolo: string,
  yIniziale: number,
  giocatori: Player[],
  azioni: Azione[],
  fondamentale: FondamentaleStat,
): number {
  let y = yIniziale;
  doc.setFontSize(14);
  doc.text(titolo, 14, y);
  y += 8;

  doc.setFontSize(10);
  const larghezzaBarraMax = 100;
  for (const giocatore of giocatori) {
    const stats = calcolaStatistiche(azioni, fondamentale, giocatore.id);
    if (stats.tentativi === 0) continue;
    doc.text(`#${giocatore.numero} ${giocatore.nome} (${stats.efficienzaPercento.toFixed(0)}%)`, 14, y);
    doc.rect(90, y - 4, larghezzaBarraMax, 4);
    const larghezzaBarra = Math.max(0, (Math.max(0, stats.efficienzaPercento) / 100) * larghezzaBarraMax);
    if (larghezzaBarra > 0) {
      doc.setFillColor(37, 99, 235);
      doc.rect(90, y - 4, larghezzaBarra, 4, 'F');
    }
    y += 8;
  }
  return y;
}

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const { match, giocatori, riepiloghi, tutteLeAzioni } = await caricaRiepilogoPartita(matchId);

  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(`Report partita — ${match.data}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  for (const { set, punteggioA, punteggioB } of riepiloghi) {
    doc.text(`Set ${set.numero}: ${punteggioA} - ${punteggioB}`, 14, y);
    y += 7;
  }
  y += 5;

  y = disegnaEfficienzaPerGiocatore(doc, 'Efficienza attacco per giocatore', y, giocatori, tutteLeAzioni, 'attacco');
  y += 5;
  disegnaEfficienzaPerGiocatore(doc, 'Efficienza contrattacco per giocatore', y, giocatori, tutteLeAzioni, 'contrattacco');

  const squadre: [Squadra, string][] = [
    ['A', 'Squadra A'],
    ['B', 'Squadra B'],
  ];

  doc.addPage();
  let yFrecce = 20;
  doc.setFontSize(16);
  doc.text('Direzioni attacco', 14, yFrecce);
  yFrecce += 10;
  for (const [squadra, etichetta] of squadre) {
    doc.setFontSize(12);
    doc.text(etichetta, 14, yFrecce);
    yFrecce += 4;
    disegnaCampoConFrecce(doc, 14, yFrecce, 180, 90, frecceAttacco(tutteLeAzioni, squadra));
    disegnaLegendaFrecce(doc, 14, yFrecce + 90 + 6);
    yFrecce += 90 + 14;
  }

  doc.addPage();
  let yFrecceBattuta = 20;
  doc.setFontSize(16);
  doc.text('Direzioni battuta', 14, yFrecceBattuta);
  yFrecceBattuta += 10;
  for (const [squadra, etichetta] of squadre) {
    doc.setFontSize(12);
    doc.text(etichetta, 14, yFrecceBattuta);
    yFrecceBattuta += 4;
    disegnaCampoConFrecce(doc, 14, yFrecceBattuta, 180, 90, frecceBattuta(tutteLeAzioni, squadra));
    disegnaLegendaFrecce(doc, 14, yFrecceBattuta + 90 + 6, 'Ricevuta');
    yFrecceBattuta += 90 + 14;
  }

  disegnaGrigliaDirezioniGiocatori(doc, 'Direzioni attacco per giocatore', giocatori, tutteLeAzioni, frecceAttacco, 'Difeso');
  disegnaGrigliaDirezioniGiocatori(doc, 'Direzioni battuta per giocatore', giocatori, tutteLeAzioni, frecceBattuta, 'Ricevuta');

  return doc.output('blob');
}

export function scaricaPdf(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
