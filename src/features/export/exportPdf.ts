import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaRigaGiocatore, calcolaRigaSquadra } from '@/domain/statisticheComplete';
import { frecceAttacco, frecceBattuta, puntoIncrocioRete, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import { GRUPPI_TABELLINO, valoriRigaTabellino } from './tabellinoColonne';
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

    // Toccata dal muro: linea spezzata origine->rete->destinazione (con un
    // pallino sul punto di tocco) invece che dritta, cosi' si vede la
    // deviazione senza dover registrare un terzo punto a parte.
    if (freccia.toccoMuro) {
      const tocco = puntoIncrocioRete(freccia.origine, freccia.destinazione);
      const xt = px(tocco.x);
      const yt = py(tocco.y);
      doc.line(x1, y1, xt, yt);
      doc.line(xt, yt, x2, y2);
      doc.circle(xt, yt, 0.7, 'F');
    } else {
      doc.line(x1, y1, x2, y2);
    }

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

  doc.addPage('a4', 'portrait');
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
      doc.addPage('a4', 'portrait');
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

// Tabellino denso stile Click&Scout: un'intestazione a due righe (gruppo di
// fondamentale + sotto-colonne, stessa definizione condivisa con l'Excel) e
// una riga per giocatore. Con ~40 colonne totali non entra in larghezza
// nemmeno in orizzontale: horizontalPageBreak continua le colonne in
// eccedenza su pagine successive, ripetendo #/Giocatore per riferimento.
function disegnaTabellino(doc: jsPDF, titolo: string, squadra: Squadra, giocatori: Player[], azioni: Azione[]): void {
  doc.addPage('a4', 'landscape');
  doc.setFontSize(16);
  doc.text(titolo, 14, 15);

  const rigaGruppi = [
    { content: '#', rowSpan: 2 },
    { content: 'Giocatore', rowSpan: 2 },
    ...GRUPPI_TABELLINO.map((gruppo) => ({ content: gruppo.titolo, colSpan: gruppo.colonne.length })),
  ];
  const rigaSottocolonne = GRUPPI_TABELLINO.flatMap((gruppo) => gruppo.colonne);
  const corpo = giocatori.map((giocatore) => [
    giocatore.numero,
    giocatore.nome,
    ...valoriRigaTabellino(calcolaRigaGiocatore(azioni, giocatore.id)),
  ]);

  const totale = ['', 'Totale squadra', ...valoriRigaTabellino(calcolaRigaSquadra(azioni, squadra))];

  autoTable(doc, {
    head: [rigaGruppi, rigaSottocolonne],
    body: corpo,
    foot: [totale],
    showFoot: 'lastPage',
    footStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
    headStyles: { fillColor: [30, 58, 95], fontSize: 6 },
    columnStyles: { 1: { halign: 'left', cellWidth: 26 } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: [0, 1],
  });
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

  const giocatoriA = giocatori.filter((g) => g.teamId === match.squadraAId);
  const giocatoriB = giocatori.filter((g) => g.teamId === match.squadraBId);
  disegnaTabellino(doc, 'Tabellino — Squadra A', 'A', giocatoriA, tutteLeAzioni);
  disegnaTabellino(doc, 'Tabellino — Squadra B', 'B', giocatoriB, tutteLeAzioni);

  const squadre: [Squadra, string][] = [
    ['A', 'Squadra A'],
    ['B', 'Squadra B'],
  ];

  doc.addPage('a4', 'portrait');
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

  doc.addPage('a4', 'portrait');
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
